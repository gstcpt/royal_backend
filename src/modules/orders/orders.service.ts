import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderChannel, OrderStatus, PaymentMethod } from '@royal/shared-types';
import { ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly couponsService: CouponsService,
  ) {}

  async create(dto: CreateOrderDto, userId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le panier de commande est vide.');
    }

    // 1. Resolve Warehouse
    let warehouse = null;
    if (dto.warehouseId) {
      warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    }
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.findFirst({
        where: { isDefault: true, isActive: true },
      });
    }
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.findFirst({ where: { isActive: true } });
    }
    if (!warehouse) {
      throw new BadRequestException('Aucun entrepôt actif disponible pour honorer la commande.');
    }

    // 2. Resolve Customer (Authenticated vs Guest)
    let customerId: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { customer: true },
      });

      if (user?.customer) {
        customerId = user.customer.id;
      } else if (user) {
        const newCust = await this.prisma.customer.create({
          data: {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
          },
        });
        customerId = newCust.id;
      }
    }

    // If guest, ensure guest details are provided and ensure customer record exists for foreign key
    if (!customerId && !dto.guestInfo) {
      throw new BadRequestException(
        'Les informations de contact (email, nom, téléphone) sont obligatoires pour une commande invité.',
      );
    }

    if (!customerId && dto.guestInfo) {
      const phoneClean = (dto.guestInfo.phone || '').replace(/\D+/g, '') || String(Date.now());
      const guestEmail = dto.guestInfo.email?.trim()
        ? dto.guestInfo.email.trim().toLowerCase()
        : `guest.${phoneClean}@royal.com.tn`;
      let guestCust = await this.prisma.customer.findUnique({
        where: { email: guestEmail },
      });

      if (!guestCust) {
        guestCust = await this.prisma.customer.create({
          data: {
            email: guestEmail,
            firstName: dto.guestInfo.firstName,
            lastName: dto.guestInfo.lastName,
            phone: dto.guestInfo.phone,
          },
        });
      }
      customerId = guestCust.id;
    }

    // 3. Load variants & snapshot pricing
    let subtotal = new Decimal(0);
    const itemsToSnapshot: any[] = [];

    for (const itemInput of dto.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: itemInput.variantId },
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1 },
            },
          },
        },
      });

      if (!variant) {
        throw new NotFoundException(`Variante de produit introuvable : ${itemInput.variantId}`);
      }

      if (!variant.isActive || variant.product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`Le produit "${variant.product.name}" n'est plus actif à la vente.`);
      }

      const rawPrice = variant.sellingPrice ?? variant.product.discountPrice ?? variant.product.sellingPrice ?? variant.product.basePrice;
      const unitPrice = new Decimal(rawPrice.toString());
      const lineTotal = unitPrice.times(itemInput.quantity);
      subtotal = subtotal.plus(lineTotal);

      itemsToSnapshot.push({
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        imageUrl: variant.product.images[0]?.url || null,
        unitPrice,
        taxRate: new Decimal(0.19), // 19% TVA standard
        quantity: itemInput.quantity,
        totalPrice: lineTotal,
      });
    }

    // 4. Calculate promotions & shipping
    let discountAmount = new Decimal(0);
    let appliedCoupon: any = null;

    if (dto.couponCode) {
      const couponValRes = await this.couponsService.validate({
        code: dto.couponCode,
        orderAmount: subtotal.toNumber(),
        customerId: customerId || undefined,
        customerEmail: dto.guestInfo?.email?.trim().toLowerCase() || undefined,
        items: itemsToSnapshot.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice.toNumber(),
        })),
      });

      if (couponValRes.valid) {
        appliedCoupon = couponValRes.coupon;
        discountAmount = new Decimal(couponValRes.discountAmount);
      }
    }

    const shipSettings = await this.prisma.settings.findMany({
      where: { key: { in: ['shipping.free_threshold', 'shipping.standard_fee'] } },
    });
    const shipMap = new Map(shipSettings.map((s) => [s.key, Number(s.value)]));
    const shippingThreshold = shipMap.get('shipping.free_threshold') ?? 150.0;
    const standardShipping = shipMap.get('shipping.standard_fee') ?? 7.0;
    const subtotalAfterDiscount = Decimal.max(0, subtotal.minus(discountAmount));
    const shippingAmount = subtotalAfterDiscount.greaterThanOrEqualTo(shippingThreshold)
      ? new Decimal(0)
      : new Decimal(standardShipping);

    const taxAmount = subtotalAfterDiscount.times(0.19);
    const totalAmount = subtotalAfterDiscount.plus(shippingAmount);

    // 5. Generate human-readable reference: CMD-YYYYMMDD-XXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const reference = `CMD-${datePart}-${randPart}`;

    // 6. Execute atomic creation & stock reservation in Prisma transaction
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // Deduct or reserve stock for each item from assigned/available warehouse
      for (const item of dto.items) {
        let targetWhId = warehouse.id;
        const defaultStock = await tx.stock.findUnique({
          where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: warehouse.id } },
        });
        if (!defaultStock) {
          const anyStock = await tx.stock.findFirst({
            where: { variantId: item.variantId, physicalQty: { gte: item.quantity } },
          });
          if (anyStock) {
            targetWhId = anyStock.warehouseId;
          } else {
            // Initialize stock from product metadata if present (e.g., quick catalog creation)
            const variantRec = await tx.productVariant.findUnique({
              where: { id: item.variantId },
              include: { product: { select: { dimensionsJson: true } } },
            });
            const metaQty = Number((variantRec?.product?.dimensionsJson as any)?.stockQuantity ?? 20);
            await tx.stock.create({
              data: {
                variantId: item.variantId,
                warehouseId: warehouse.id,
                physicalQty: metaQty > 0 ? metaQty : 20,
                reservedQty: 0,
              },
            });
          }
        }
        await this.inventoryService.deductStock(
          item.variantId,
          targetWhId,
          item.quantity,
          'ONLINE_SALE',
          reference,
          userId || 'GUEST',
          false,
        );
      }

      // If coupon used, increment usage count & create usage record
      if (appliedCoupon) {
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          reference,
          customerId,
          guestEmail: dto.guestInfo?.email ? dto.guestInfo.email.trim().toLowerCase() : null,
          guestPhone: dto.guestInfo?.phone || null,
          guestName: dto.guestInfo ? `${dto.guestInfo.firstName} ${dto.guestInfo.lastName}`.trim() : null,
          guestData: dto.guestInfo?.extraFields || null,
          status: OrderStatus.PENDING,
          channel: dto.channel || OrderChannel.ONLINE,
          subtotalAmount: subtotal,
          discountAmount,
          taxAmount,
          shippingAmount,
          totalAmount,
          currency: 'TND',
          couponId: appliedCoupon?.id || null,
          couponCode: appliedCoupon?.code || null,
          couponDiscount: appliedCoupon ? discountAmount : null,
          shippingAddressJson: dto.shippingAddress as any,
          billingAddressJson: (dto.billingAddress || dto.shippingAddress) as any,
          deliveryMethodId: dto.deliveryMethod || 'STANDARD_HOME',
          notes: dto.notes,
          items: {
            create: itemsToSnapshot.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              productName: it.productName,
              variantName: it.variantName,
              sku: it.sku,
              imageUrl: it.imageUrl,
              unitPrice: it.unitPrice,
              taxRate: it.taxRate,
              quantity: it.quantity,
              totalPrice: it.totalPrice,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.PENDING,
              changedBy: userId || 'GUEST',
              comment: 'Commande passée en ligne sur Maison Royal',
            },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (appliedCoupon) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCoupon.id,
            orderId: newOrder.id,
            customerId,
          },
        });
      }

      // Record initial payment record
      await tx.payment.create({
        data: {
          order: { connect: { id: newOrder.id } },
          amount: totalAmount,
          currency: 'TND',
          method: dto.paymentMethod as any,
          status: 'PENDING',
          idempotencyKey: `PAY-${newOrder.reference}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        },
      });

      return newOrder;
    });

    return createdOrder;
  }

  async findMyOrders(userId: string, query: QueryOrdersDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });

    if (!user) {
      return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }

    let customerId = user.customer?.id;
    if (!customerId) {
      const byEmail = await this.prisma.customer.findUnique({
        where: { email: user.email.toLowerCase() },
      });
      if (byEmail) {
        customerId = byEmail.id;
      }
    }

    if (customerId) {
      const res = await this.findAll({ ...query, customerId });
      if ((res?.data || []).length > 0) {
        return res;
      }
    }

    return this.findAll(query);
  }

  async findAll(query: QueryOrdersDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { guestName: { contains: query.search, mode: 'insensitive' } },
        { guestEmail: { contains: query.search, mode: 'insensitive' } },
        { guestPhone: { contains: query.search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (!where.isDeleted) {
      where.isDeleted = false;
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          items: true,
          payments: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(idOrReference: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrReference }, { reference: idOrReference }],
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        payments: true,
        delivery: true,
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Commande introuvable : ${idOrReference}`);
    }

    return order;
  }

  async updateStatus(id: string, newStatus: OrderStatus, changedBy: string, comment?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }

    const oldStatus = order.status;
    if (oldStatus === newStatus) {
      return order;
    }

    // State machine check
    if (oldStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException('Une commande déjà annulée ne peut pas être modifiée.');
    }

    if (oldStatus === OrderStatus.DELIVERED && newStatus !== OrderStatus.REFUNDED) {
      throw new BadRequestException('Une commande livrée ne peut plus changer de statut hormis pour remboursement.');
    }

    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === OrderStatus.CONFIRMED && !order.confirmedAt) {
      updateData.confirmedAt = new Date();
    } else if (newStatus === OrderStatus.SHIPPED && !order.shippedAt) {
      updateData.shippedAt = new Date();
    } else if (newStatus === OrderStatus.DELIVERED && !order.deliveredAt) {
      updateData.deliveredAt = new Date();
    } else if (newStatus === OrderStatus.CANCELLED && !order.cancelledAt) {
      updateData.cancelledAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      // If cancelled, restore physical stock to default warehouse
      if (newStatus === OrderStatus.CANCELLED) {
        const defaultWh = await tx.warehouse.findFirst({ where: { isDefault: true } });
        if (defaultWh) {
          for (const item of order.items) {
            if (item.variantId) {
              const existingStock = await tx.stock.findUnique({
                where: {
                  variantId_warehouseId: {
                    variantId: item.variantId,
                    warehouseId: defaultWh.id,
                  },
                },
              });
              const currentQty = existingStock?.physicalQty ?? 0;
              await this.inventoryService.adjustStock(
                {
                  variantId: item.variantId,
                  warehouseId: defaultWh.id,
                  newPhysicalQty: currentQty + item.quantity,
                  reason: `Rétablissement stock suite annulation commande ${order.reference}`,
                },
                changedBy,
              );
            }
          }
        }
      }

      // Record status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedBy,
          comment: comment || `Passage de l'état ${oldStatus} à ${newStatus}`,
        },
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: updateData,
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
          items: true,
          customer: true,
        },
      });

      if (updated.customer?.userId) {
        const notifType =
          newStatus === OrderStatus.CANCELLED
            ? 'ORDER_CANCELLED'
            : newStatus === OrderStatus.DELIVERED
            ? 'ORDER_DELIVERED'
            : newStatus === OrderStatus.SHIPPED || newStatus === OrderStatus.OUT_FOR_DELIVERY
            ? 'ORDER_SHIPPED'
            : 'ORDER_CONFIRMED';

        await tx.notification.create({
          data: {
            userId: updated.customer.userId,
            type: notifType as any,
            title: `Commande ${updated.reference} : statut mis à jour`,
            body: `Votre commande est passée de ${oldStatus} à ${newStatus}.${comment ? ` Note : ${comment}` : ''}`,
            link: `/order-confirmation/${updated.reference}`,
            metadata: {
              channel: 'ORDER',
              severity: newStatus === OrderStatus.CANCELLED ? 'WARNING' : 'INFO',
              targetRoles: 'CLIENT',
              orderReference: updated.reference,
              oldStatus,
              newStatus,
            } as any,
          },
        }).catch(() => null);
      }

      return updated;
    });
  }

  async trackGuestOrder(reference: string, emailOrPhone: string) {
    const cleanRef = reference.trim().toUpperCase();
    const cleanContact = emailOrPhone.trim().toLowerCase();

    const order = await this.prisma.order.findFirst({
      where: {
        reference: cleanRef,
        OR: [
          { guestEmail: { equals: cleanContact, mode: 'insensitive' } },
          { guestPhone: { contains: cleanContact } },
        ],
      },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Aucune commande correspondante trouvée.');
    }

    return order;
  }

  async bulkAction(
    ids: string[],
    action: 'STATUS' | 'DELETE',
    status?: OrderStatus,
    changedBy = 'admin',
    comment?: string,
  ) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { updated: 0, skipped: 0, errors: [] as string[] };
    }
    if (action === 'DELETE') {
      const res = await this.prisma.order.updateMany({
        where: { id: { in: uniqueIds } },
        data: { isDeleted: true },
      });
      return { updated: res.count, skipped: uniqueIds.length - res.count, errors: [] as string[] };
    }
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    if (status) {
      for (const id of uniqueIds) {
        try {
          await this.updateStatus(id, status, changedBy, comment);
          updated++;
        } catch (err: any) {
          skipped++;
          errors.push(err?.message || `Erreur sur ${id}`);
        }
      }
    }
    return { updated, skipped, errors };
  }
}
