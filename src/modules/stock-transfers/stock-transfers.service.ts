import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { NotificationType, StockMovementType, StockTransferStatus } from '@prisma/client';
import { allocateSystemDocumentReference } from '../deliveries/delivery-pricing.helper';

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: StockTransferStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const rows = await this.prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true, city: true } },
        toWarehouse: { select: { id: true, name: true, code: true, city: true } },
        order: {
          select: {
            id: true,
            reference: true,
            status: true,
            guestName: true,
            totalAmount: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        },
        showroom: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    const variantIds = Array.from(
      new Set(rows.flatMap((r) => r.items.map((it) => it.variantId)).filter(Boolean)),
    );
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return rows.map((r) => ({
      ...r,
      items: r.items.map((it) => {
        const v = variantMap.get(it.variantId);
        return {
          ...it,
          sku: v?.sku || v?.product?.sku || it.variantId,
          productName: v?.product?.name || `Variante ${it.variantId}`,
          variantName: v?.name || null,
        };
      }),
    }));
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        showroom: true,
        order: {
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            items: true,
          },
        },
        items: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfert introuvable avec l’ID : ${id}`);
    }

    const variantIds = Array.from(new Set(transfer.items.map((it) => it.variantId)));
    const [variants, stocks, movements] = await Promise.all([
      variantIds.length
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              sku: true,
              name: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          })
        : Promise.resolve([]),
      variantIds.length
        ? this.prisma.stock.findMany({
            where: {
              variantId: { in: variantIds },
              warehouseId: { in: [transfer.fromWarehouseId, transfer.toWarehouseId] },
            },
          })
        : Promise.resolve([]),
      this.prisma.stockMovement.findMany({
        where: { referenceId: transfer.reference },
        orderBy: { createdAt: 'asc' },
        include: {
          stock: {
            select: {
              warehouse: { select: { id: true, name: true, code: true } },
              variantId: true,
            },
          },
        },
      }),
    ]);

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const stockKey = (whId: string, varId: string) => `${whId}:${varId}`;
    const stockMap = new Map(stocks.map((s) => [stockKey(s.warehouseId, s.variantId), s.physicalQty]));

    return {
      ...transfer,
      items: transfer.items.map((it) => {
        const v = variantMap.get(it.variantId);
        return {
          ...it,
          sku: v?.sku || v?.product?.sku || it.variantId,
          productName: v?.product?.name || `Variante ${it.variantId}`,
          variantName: v?.name || null,
          sourceAvailableQty: stockMap.get(stockKey(transfer.fromWarehouseId, it.variantId)) ?? 0,
          targetAvailableQty: stockMap.get(stockKey(transfer.toWarehouseId, it.variantId)) ?? 0,
        };
      }),
      movements,
    };
  }

  async create(dto: CreateStockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('L’entrepôt d’origine et de destination doivent être différents.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le transfert doit contenir au moins un article.');
    }

    const reference = await allocateSystemDocumentReference(
      this.prisma,
      'TRF',
      '{PREFIX}-{YYYY}-{SEQ4}',
    );
    const requestRef = await allocateSystemDocumentReference(
      this.prisma,
      'DTR',
      '{PREFIX}-{YYYY}-{SEQ4}',
    );

    const created = await this.prisma.stockTransfer.create({
      data: {
        reference,
        requestRef,
        requestType: 'INTERNAL',
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        notes: dto.notes,
        requestedBy: userId,
        status: StockTransferStatus.PENDING,
        items: {
          create: dto.items.map((i) => ({
            variantId: i.variantId,
            requestedQty: i.requestedQty,
            transferredQty: 0,
          })),
        },
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: true,
      },
    });

    await this.prisma.notification.create({
      data: {
        type: NotificationType.TRANSFER_REQUEST,
        title: `Demande de transfert interne (${created.requestRef || created.reference})`,
        body: `Demande de transfert de ${created.fromWarehouse.name} vers ${created.toWarehouse.name} (${created.items.length} ligne(s)). Validation requise.`,
        link: `/dashboard/transfers/${created.id}`,
        metadata: {
          channel: 'STOCK',
          severity: 'WARNING',
          targetRoles: 'ROOT / SUPER_ADMIN / WEBSITE_MANAGER',
          transferId: created.id,
          requestRef: created.requestRef,
          reference: created.reference,
        },
      },
    });

    return created;
  }

  async accept(id: string, userId: string, mode: 'IMMEDIATE' | 'STEP_BY_STEP' = 'STEP_BY_STEP') {
    const cleanMode = mode === 'IMMEDIATE' ? 'IMMEDIATE' : 'STEP_BY_STEP';

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true, fromWarehouse: true, toWarehouse: true, order: true },
      });

      if (!transfer) {
        throw new NotFoundException(`Transfert introuvable avec l’ID : ${id}`);
      }

      if (transfer.status !== StockTransferStatus.PENDING) {
        throw new BadRequestException(
          `Cette demande a déjà le statut ${transfer.status} et ne peut plus être acceptée.`,
        );
      }

      const now = new Date();
      let bonReference = transfer.reference;
      if (!bonReference || bonReference.startsWith('DTR-')) {
        bonReference = await allocateSystemDocumentReference(tx, 'TRF', '{PREFIX}-{YYYY}-{SEQ4}');
      }

      if (cleanMode === 'STEP_BY_STEP') {
        const approved = await tx.stockTransfer.update({
          where: { id },
          data: {
            reference: bonReference,
            status: StockTransferStatus.APPROVED,
            acceptanceMode: 'STEP_BY_STEP',
            approvedBy: userId,
            approvedAt: now,
          },
          include: {
            fromWarehouse: true,
            toWarehouse: true,
            showroom: true,
            order: true,
            items: true,
          },
        });

        await tx.notification.create({
          data: {
            type: NotificationType.TRANSFER_APPROVED,
            title: `Bon de transfert approuvé (${approved.reference})`,
            body: `Transfert ${approved.fromWarehouse.name} ➔ ${approved.toWarehouse.name} prêt pour expédition (Sortie BS) puis réception (Entrée BE).`,
            link: `/dashboard/transfers/${approved.id}`,
            metadata: {
              channel: 'STOCK',
              severity: 'INFO',
              targetRoles: 'ROOT / SUPER_ADMIN / WEBSITE_MANAGER / STOCK_MANAGER',
              transferId: approved.id,
              reference: approved.reference,
            },
          },
        });

        return approved;
      }

      // IMMEDIATE: Execute TRANSFER_OUT (Sender) and TRANSFER_IN (Receiver) atomically
      for (const item of transfer.items) {
        const originStock = await tx.stock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.fromWarehouseId,
            },
          },
        });

        if (!originStock || originStock.physicalQty < item.requestedQty) {
          throw new BadRequestException(
            `Stock d'origine insuffisant sur ${transfer.fromWarehouse.name} pour la variante ${item.variantId}. Disponible : ${
              originStock?.physicalQty || 0
            }, requis : ${item.requestedQty}`,
          );
        }

        const beforeOut = originStock.physicalQty;
        const afterOut = beforeOut - item.requestedQty;

        await tx.stockMovement.create({
          data: {
            stockId: originStock.id,
            type: StockMovementType.TRANSFER_OUT,
            quantityDelta: -item.requestedQty,
            quantityBefore: beforeOut,
            quantityAfter: afterOut,
            referenceType: 'TRANSFER',
            referenceId: bonReference,
            reason: `Sortie transfert immédiate vers ${transfer.toWarehouse.name}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: originStock.id },
          data: { physicalQty: afterOut },
        });

        let destStock = await tx.stock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.toWarehouseId,
            },
          },
        });

        if (!destStock) {
          destStock = await tx.stock.create({
            data: {
              variantId: item.variantId,
              warehouseId: transfer.toWarehouseId,
              physicalQty: 0,
              reservedQty: 0,
            },
          });
        }

        const beforeIn = destStock.physicalQty;
        const afterIn = beforeIn + item.requestedQty;

        await tx.stockMovement.create({
          data: {
            stockId: destStock.id,
            type: StockMovementType.TRANSFER_IN,
            quantityDelta: item.requestedQty,
            quantityBefore: beforeIn,
            quantityAfter: afterIn,
            referenceType: 'TRANSFER',
            referenceId: bonReference,
            reason: `Entrée transfert immédiate depuis ${transfer.fromWarehouse.name}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: destStock.id },
          data: { physicalQty: afterIn },
        });

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { transferredQty: item.requestedQty },
        });
      }

      const completed = await tx.stockTransfer.update({
        where: { id },
        data: {
          reference: bonReference,
          status: StockTransferStatus.COMPLETED,
          acceptanceMode: 'IMMEDIATE',
          approvedBy: userId,
          approvedAt: now,
          completedBy: userId,
          completedAt: now,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          showroom: true,
          order: true,
          items: true,
        },
      });

      await tx.notification.create({
        data: {
          type: NotificationType.TRANSFER_COMPLETED,
          title: `Transfert exécuté (${completed.reference})`,
          body: `Bon de transfert ${completed.reference} : sortie ${completed.fromWarehouse.name} et entrée ${completed.toWarehouse.name} effectuées.`,
          link: `/dashboard/transfers/${completed.id}`,
          metadata: {
            channel: 'STOCK',
            severity: 'SUCCESS',
            targetRoles: 'ROOT / SUPER_ADMIN / WEBSITE_MANAGER / STOCK_MANAGER',
            transferId: completed.id,
            reference: completed.reference,
          },
        },
      });

      return completed;
    });
  }

  async approve(id: string, userId: string) {
    return this.accept(id, userId, 'STEP_BY_STEP');
  }

  async dispatch(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true, fromWarehouse: true, toWarehouse: true },
      });

      if (!transfer) {
        throw new NotFoundException('Transfert introuvable.');
      }

      if (
        transfer.status !== StockTransferStatus.APPROVED &&
        transfer.status !== StockTransferStatus.PENDING
      ) {
        throw new BadRequestException(
          `Impossible d'expédier un transfert avec le statut ${transfer.status}`,
        );
      }

      for (const item of transfer.items) {
        const originStock = await tx.stock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.fromWarehouseId,
            },
          },
        });

        if (!originStock || originStock.physicalQty < item.requestedQty) {
          throw new BadRequestException(
            `Stock d'origine insuffisant pour la variante ${item.variantId}. Disponible : ${
              originStock?.physicalQty || 0
            }, requis : ${item.requestedQty}`,
          );
        }

        const before = originStock.physicalQty;
        const after = before - item.requestedQty;

        await tx.stockMovement.create({
          data: {
            stockId: originStock.id,
            type: StockMovementType.TRANSFER_OUT,
            quantityDelta: -item.requestedQty,
            quantityBefore: before,
            quantityAfter: after,
            referenceType: 'TRANSFER',
            referenceId: transfer.reference,
            reason: `Expédition transfert vers ${transfer.toWarehouse.name}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: originStock.id },
          data: { physicalQty: after },
        });

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { transferredQty: item.requestedQty },
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
          approvedBy: transfer.approvedBy || userId,
          approvedAt: transfer.approvedAt || new Date(),
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          showroom: true,
          order: true,
          items: true,
        },
      });
    });
  }

  async receive(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true, fromWarehouse: true, toWarehouse: true },
      });

      if (!transfer) {
        throw new NotFoundException('Transfert introuvable.');
      }

      if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new BadRequestException(
          `Seuls les transferts en transit peuvent être réceptionnés. Statut actuel : ${transfer.status}`,
        );
      }

      for (const item of transfer.items) {
        let destStock = await tx.stock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.toWarehouseId,
            },
          },
        });

        if (!destStock) {
          destStock = await tx.stock.create({
            data: {
              variantId: item.variantId,
              warehouseId: transfer.toWarehouseId,
              physicalQty: 0,
              reservedQty: 0,
            },
          });
        }

        const qtyToAdd = item.transferredQty > 0 ? item.transferredQty : item.requestedQty;
        const before = destStock.physicalQty;
        const after = before + qtyToAdd;

        await tx.stockMovement.create({
          data: {
            stockId: destStock.id,
            type: StockMovementType.TRANSFER_IN,
            quantityDelta: qtyToAdd,
            quantityBefore: before,
            quantityAfter: after,
            referenceType: 'TRANSFER',
            referenceId: transfer.reference,
            reason: `Réception transfert depuis ${transfer.fromWarehouse.name}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: destStock.id },
          data: { physicalQty: after },
        });
      }

      const completed = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.COMPLETED,
          completedBy: userId,
          completedAt: new Date(),
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          showroom: true,
          order: true,
          items: true,
        },
      });

      await tx.notification.create({
        data: {
          type: NotificationType.TRANSFER_COMPLETED,
          title: `Transfert réceptionné (${completed.reference})`,
          body: `Réception confirmée sur ${completed.toWarehouse.name}. Articles prêts pour retrait/stock.`,
          link: `/dashboard/transfers/${completed.id}`,
          metadata: {
            channel: 'STOCK',
            severity: 'SUCCESS',
            targetRoles: 'ROOT / SUPER_ADMIN / WEBSITE_MANAGER / STOCK_MANAGER',
            transferId: completed.id,
            reference: completed.reference,
          },
        },
      });

      return completed;
    });
  }

  async cancel(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw new NotFoundException('Transfert introuvable.');
      }

      if (transfer.status === StockTransferStatus.COMPLETED) {
        throw new BadRequestException('Un transfert déjà réceptionné ne peut pas être annulé.');
      }

      if (transfer.status === StockTransferStatus.IN_TRANSIT) {
        for (const item of transfer.items) {
          const originStock = await tx.stock.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: transfer.fromWarehouseId,
              },
            },
          });

          if (originStock) {
            const before = originStock.physicalQty;
            const after = before + item.transferredQty;

            await tx.stockMovement.create({
              data: {
                stockId: originStock.id,
                type: StockMovementType.ADJUSTMENT_IN,
                quantityDelta: item.transferredQty,
                quantityBefore: before,
                quantityAfter: after,
                referenceType: 'TRANSFER_CANCEL',
                referenceId: transfer.reference,
                reason: `Annulation du transfert en transit ${transfer.reference}`,
                performedBy: userId,
              },
            });

            await tx.stock.update({
              where: { id: originStock.id },
              data: { physicalQty: after },
            });
          }
        }
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.CANCELLED },
      });
    });
  }
}
