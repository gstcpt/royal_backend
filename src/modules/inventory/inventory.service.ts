import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockMovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryStockDto) {
    const { page = 1, limit = 20, warehouseId, search, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.variant = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          {
            product: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      };
    }

    const [total, stockRecords] = await Promise.all([
      this.prisma.stock.count({ where }),
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sku: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { url: true },
                  },
                  category: { select: { id: true, name: true } },
                  brand: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = stockRecords.map((s) => {
      const availableQty = Math.max(0, s.physicalQty - s.reservedQty);
      const reorderPoint = s.reorderPoint ?? 5;
      const isLowStock = availableQty <= reorderPoint;

      return {
        id: s.id,
        variantId: s.variantId,
        productId: s.variant.productId,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseCode: s.warehouse.code,
        productName: s.variant.product.name,
        variantName: s.variant.name,
        sku: s.variant.sku,
        barcode: s.variant.barcode,
        primaryImage: s.variant.product.images[0]?.url || null,
        category: s.variant.product.category?.name,
        brand: s.variant.product.brand?.name,
        physicalQty: s.physicalQty,
        reservedQty: s.reservedQty,
        availableQty,
        incomingQty: s.incomingQty,
        damagedQty: s.damagedQty,
        reorderPoint,
        isLowStock,
        updatedAt: s.updatedAt,
      };
    });

    const filtered = lowStockOnly ? formatted.filter((f) => f.isLowStock) : formatted;

    return {
      data: filtered,
      meta: {
        page,
        limit,
        total: lowStockOnly ? filtered.length : total,
        totalPages: Math.ceil((lowStockOnly ? filtered.length : total) / limit),
      },
    };
  }

  async getLowStockAlerts(warehouseId?: string) {
    const where: any = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const stock = await this.prisma.stock.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    return stock
      .filter((s) => {
        const available = s.physicalQty - s.reservedQty;
        const threshold = s.reorderPoint ?? 5;
        return available <= threshold;
      })
      .map((s) => ({
        stockId: s.id,
        productName: s.variant.product.name,
        variantName: s.variant.name,
        sku: s.variant.sku,
        warehouseName: s.warehouse.name,
        physicalQty: s.physicalQty,
        reservedQty: s.reservedQty,
        availableQty: Math.max(0, s.physicalQty - s.reservedQty),
        reorderPoint: s.reorderPoint ?? 5,
        primaryImage: s.variant.product.images[0]?.url || null,
      }));
  }

  async adjustStock(dto: AdjustStockDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Find or create the stock record for this variant & warehouse
      let stock = await tx.stock.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      if (!stock) {
        stock = await tx.stock.create({
          data: {
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
            physicalQty: 0,
            reservedQty: 0,
          },
        });
      }

      const quantityBefore = stock.physicalQty;
      const quantityAfter = dto.newPhysicalQty;
      const quantityDelta = quantityAfter - quantityBefore;

      if (quantityDelta === 0) {
        return stock;
      }

      // Record immutable movement
      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: dto.type || (quantityDelta > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT),
          quantityDelta,
          quantityBefore,
          quantityAfter,
          reason: dto.reason || 'Ajustement manuel d’inventaire',
          notes: dto.notes,
          performedBy: userId,
        },
      });

      // Update stock
      return tx.stock.update({
        where: { id: stock.id },
        data: {
          physicalQty: quantityAfter,
        },
        include: {
          warehouse: { select: { name: true, code: true } },
          variant: { select: { sku: true, name: true } },
        },
      });
    });
  }

  async reserveStock(dto: ReserveStockDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      if (!stock) {
        throw new NotFoundException('Article non référencé dans cet entrepôt.');
      }

      const available = stock.physicalQty - stock.reservedQty;
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Stock insuffisant. Disponible : ${available}, demandé : ${dto.quantity}`,
        );
      }

      const quantityBefore = stock.reservedQty;
      const quantityAfter = quantityBefore + dto.quantity;

      // Create StockMovement for reservation
      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: StockMovementType.RESERVED,
          quantityDelta: dto.quantity,
          quantityBefore,
          quantityAfter,
          referenceType: dto.referenceType || 'ORDER',
          referenceId: dto.referenceId,
          reason: 'Réservation de stock',
          notes: dto.notes,
          performedBy: userId,
        },
      });

      return tx.stock.update({
        where: { id: stock.id },
        data: {
          reservedQty: quantityAfter,
        },
      });
    });
  }

  async releaseStock(dto: ReserveStockDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      if (!stock) {
        throw new NotFoundException('Stock introuvable.');
      }

      const actualRelease = Math.min(stock.reservedQty, dto.quantity);
      const quantityBefore = stock.reservedQty;
      const quantityAfter = Math.max(0, quantityBefore - actualRelease);

      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: StockMovementType.UNRESERVED,
          quantityDelta: -actualRelease,
          quantityBefore,
          quantityAfter,
          referenceType: dto.referenceType || 'ORDER',
          referenceId: dto.referenceId,
          reason: 'Annulation réservation stock',
          notes: dto.notes,
          performedBy: userId,
        },
      });

      return tx.stock.update({
        where: { id: stock.id },
        data: {
          reservedQty: quantityAfter,
        },
      });
    });
  }

  async deductStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    userId: string,
    fromReserved: boolean = false,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: {
          variantId_warehouseId: {
            variantId,
            warehouseId,
          },
        },
      });

      if (!stock) {
        throw new NotFoundException('Stock introuvable pour ce produit.');
      }

      if (fromReserved) {
        if (stock.reservedQty < quantity) {
          throw new BadRequestException('Quantité réservée insuffisante pour déstockage.');
        }
      } else {
        const available = stock.physicalQty - stock.reservedQty;
        if (available < quantity) {
          throw new BadRequestException(`Stock disponible insuffisant : ${available}`);
        }
      }

      const physicalBefore = stock.physicalQty;
      const physicalAfter = physicalBefore - quantity;
      const reservedBefore = stock.reservedQty;
      const reservedAfter = fromReserved ? reservedBefore - quantity : reservedBefore;

      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: StockMovementType.SALE_OUT,
          quantityDelta: -quantity,
          quantityBefore: physicalBefore,
          quantityAfter: physicalAfter,
          referenceType,
          referenceId,
          reason: fromReserved ? 'Expédition commande validée' : 'Vente directe caisse POS',
          performedBy: userId,
        },
      });

      return tx.stock.update({
        where: { id: stock.id },
        data: {
          physicalQty: physicalAfter,
          reservedQty: reservedAfter,
        },
      });
    });
  }

  async findMovements(query: {
    stockId?: string;
    variantId?: string;
    warehouseId?: string;
    page?: number;
    limit?: number;
  }) {
    const { stockId, variantId, warehouseId, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (stockId) where.stockId = stockId;
    if (variantId || warehouseId) {
      where.stock = {};
      if (variantId) where.stock.variantId = variantId;
      if (warehouseId) where.stock.warehouseId = warehouseId;
    }

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          stock: {
            include: {
              warehouse: { select: { id: true, name: true, code: true } },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
