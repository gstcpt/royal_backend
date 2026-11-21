import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockMovementType, StockTransferStatus } from '@prisma/client';

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: StockTransferStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfert introuvable avec l’ID : ${id}`);
    }

    return transfer;
  }

  async create(dto: CreateStockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('L’entrepôt d’origine et de destination doivent être différents.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le transfert doit contenir au moins un article.');
    }

    const reference = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    return this.prisma.stockTransfer.create({
      data: {
        reference,
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
  }

  async approve(id: string, userId: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== StockTransferStatus.PENDING) {
      throw new BadRequestException(`Impossible d'approuver un transfert avec le statut ${transfer.status}`);
    }

    return this.prisma.stockTransfer.update({
      where: { id },
      data: {
        status: StockTransferStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: true,
      },
    });
  }

  async dispatch(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
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

      // Check stock at origin and deduct
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

        // Create TRANSFER_OUT ledger record
        await tx.stockMovement.create({
          data: {
            stockId: originStock.id,
            type: StockMovementType.TRANSFER_OUT,
            quantityDelta: -item.requestedQty,
            quantityBefore: before,
            quantityAfter: after,
            referenceType: 'TRANSFER',
            referenceId: transfer.reference,
            reason: `Expédition transfert vers ${transfer.toWarehouseId}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: originStock.id },
          data: { physicalQty: after },
        });

        // Update item transferredQty
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { transferredQty: item.requestedQty },
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: true,
        },
      });
    });
  }

  async receive(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw new NotFoundException('Transfert introuvable.');
      }

      if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new BadRequestException(
          `Seuls les transferts en transit peuvent être réceptionnés. Statut actuel : ${transfer.status}`,
        );
      }

      // Increment destination warehouse stock
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

        const before = destStock.physicalQty;
        const after = before + item.transferredQty;

        // Create TRANSFER_IN ledger record
        await tx.stockMovement.create({
          data: {
            stockId: destStock.id,
            type: StockMovementType.TRANSFER_IN,
            quantityDelta: item.transferredQty,
            quantityBefore: before,
            quantityAfter: after,
            referenceType: 'TRANSFER',
            referenceId: transfer.reference,
            reason: `Réception transfert depuis ${transfer.fromWarehouseId}`,
            performedBy: userId,
          },
        });

        await tx.stock.update({
          where: { id: destStock.id },
          data: { physicalQty: after },
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.COMPLETED,
          completedBy: userId,
          completedAt: new Date(),
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: true,
        },
      });
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

      // If it was already in transit, reverse stock back to origin
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
