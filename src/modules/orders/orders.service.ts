import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CouponsService } from '../coupons/coupons.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { allocateSystemDocumentReference } from '../deliveries/delivery-pricing.helper';
import {
  generateOrderProofToken,
  verifyOrderProofToken,
} from '../../common/utils/security.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderChannel, OrderStatus, PaymentMethod } from '@royal/shared-types';
import {
  DeliveryCalculationMethod,
  DeliveryStatus,
  NotificationType,
  ProductStatus,
  StockTransferStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly couponsService: CouponsService,
    private readonly deliveriesService: DeliveriesService,
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
    let isFreeShippingCoupon = false;

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
        isFreeShippingCoupon = Boolean(couponValRes.freeShipping || couponValRes.coupon?.type === 'FREE_SHIPPING');
        discountAmount = isFreeShippingCoupon ? new Decimal(0) : new Decimal(couponValRes.discountAmount);
      }
    }

    const subtotalAfterDiscount = Decimal.max(0, subtotal.minus(discountAmount));

    const isShowroomPickup =
      dto.fulfillmentType === 'SHOWROOM_PICKUP' ||
      Boolean(dto.pickupShowroomId) ||
      dto.deliveryMethod === 'SHOWROOM_PICKUP';

    let pickupShowroom: any = null;
    let selectedQuote: any = null;
    let shippingAmount = new Decimal(0);

    if (isShowroomPickup) {
      if (dto.pickupShowroomId) {
        pickupShowroom = await this.prisma.pointOfSale.findUnique({
          where: { id: dto.pickupShowroomId },
          include: { warehouse: true },
        });
      }
      if (!pickupShowroom) {
        pickupShowroom = await this.prisma.pointOfSale.findFirst({
          where: { isActive: true },
          include: { warehouse: true },
        });
      }
      if (!pickupShowroom) {
        throw new BadRequestException('Aucun showroom actif trouvé pour le retrait en magasin.');
      }
      shippingAmount = new Decimal(0);
    } else {
      const quoteRes = await this.deliveriesService.calculateDeliveryQuotes({
        destinationCountry: dto.shippingAddress?.country || 'TN',
        destinationState: dto.shippingAddress?.state || 'Tunis',
        items: dto.items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })),
        subtotalTnd: subtotalAfterDiscount.toNumber(),
        freeShippingCoupon: isFreeShippingCoupon,
      });

      const activeQuotes = quoteRes.quotes.filter((q) => q.available && q.feeTnd !== null);
      selectedQuote =
        (dto.deliveryCompanyId
          ? activeQuotes.find((q) => q.companyId === dto.deliveryCompanyId)
          : null) || activeQuotes[0];

      if (isFreeShippingCoupon) {
        shippingAmount = new Decimal(0);
      } else if (selectedQuote && selectedQuote.feeTnd !== null) {
        shippingAmount = new Decimal(selectedQuote.feeTnd);
      } else {
        const shipSettings = await this.prisma.settings.findMany({
          where: { key: { in: ['shipping.free_threshold', 'shipping.standard_fee'] } },
        });
        const shipMap = new Map(shipSettings.map((s) => [s.key, Number(s.value)]));
        const shippingThreshold = shipMap.get('shipping.free_threshold') ?? 150.0;
        const standardShipping = shipMap.get('shipping.standard_fee') ?? 7.0;
        shippingAmount = subtotalAfterDiscount.greaterThanOrEqualTo(shippingThreshold)
          ? new Decimal(0)
          : new Decimal(standardShipping);
      }
    }

    const taxAmount = subtotalAfterDiscount.times(0.19);
    const totalAmount = subtotalAfterDiscount.plus(shippingAmount);

    // 5. Generate human-readable reference from System Prefix rules (CMD)
    const reference = await allocateSystemDocumentReference(
      this.prisma,
      'CMD',
      '{PREFIX}-{YYYY}{MM}-{SEQ4}',
    );

    // 6. Execute atomic creation, stock deduction or Showroom Transfer Request in Prisma transaction
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const transferRequestsNeeded = new Map<
        string,
        Array<{ variantId: string; requestedQty: number; productName: string; sku: string }>
      >();

      if (isShowroomPickup && pickupShowroom) {
        const targetWhId = pickupShowroom.warehouseId;
        const otherWarehouses = await tx.warehouse.findMany({
          where: { isActive: true, id: { not: targetWhId } },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });

        for (const item of dto.items) {
          const showroomStock = await tx.stock.findUnique({
            where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: targetWhId } },
          });
          const localQty = Math.max(0, Number(showroomStock?.physicalQty || 0));

          if (localQty >= item.quantity) {
            await this.inventoryService.deductStock(
              item.variantId,
              targetWhId,
              item.quantity,
              'ONLINE_SALE',
              reference,
              userId || 'GUEST',
              false,
              tx,
            );
          } else {
            const missingQty = item.quantity - localQty;
            if (localQty > 0) {
              await this.inventoryService.deductStock(
                item.variantId,
                targetWhId,
                localQty,
                'ONLINE_SALE',
                reference,
                userId || 'GUEST',
                false,
                tx,
              );
            }

            const donorStocks = await tx.stock.findMany({
              where: {
                variantId: item.variantId,
                warehouseId: { not: targetWhId },
                physicalQty: { gt: 0 },
              },
              orderBy: { physicalQty: 'desc' },
            });

            const bestDonor =
              donorStocks.find((s) => s.physicalQty >= missingQty)?.warehouseId ||
              donorStocks[0]?.warehouseId ||
              otherWarehouses[0]?.id ||
              warehouse.id;

            if (bestDonor && bestDonor !== targetWhId) {
              const snap = itemsToSnapshot.find((s) => s.variantId === item.variantId);
              const list = transferRequestsNeeded.get(bestDonor) || [];
              list.push({
                variantId: item.variantId,
                requestedQty: missingQty,
                productName: snap?.productName || 'Article',
                sku: snap?.sku || item.variantId,
              });
              transferRequestsNeeded.set(bestDonor, list);
            }
          }
        }
      } else {
        // Deduct stock for delivery order from assigned/available warehouse
        for (const item of dto.items) {
          let targetWhId = warehouse.id;
          const defaultStock = await tx.stock.findUnique({
            where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: warehouse.id } },
          });
          if (!defaultStock || defaultStock.physicalQty < item.quantity) {
            const anyStock = await tx.stock.findFirst({
              where: { variantId: item.variantId, physicalQty: { gte: item.quantity } },
            });
            if (anyStock) {
              targetWhId = anyStock.warehouseId;
            } else if (!defaultStock) {
              const variantRec = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                include: { product: { select: { dimensionsJson: true } } },
              });
              const metaQty = Number((variantRec?.product?.dimensionsJson as any)?.stockQuantity ?? 0);
              if (metaQty >= item.quantity) {
                await tx.stock.create({
                  data: {
                    variantId: item.variantId,
                    warehouseId: warehouse.id,
                    physicalQty: metaQty,
                    reservedQty: 0,
                  },
                });
              }
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
            tx,
          );
        }
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
          deliveryMethodId: isShowroomPickup
            ? `SHOWROOM_PICKUP:${pickupShowroom?.code || ''}`
            : selectedQuote?.code || dto.deliveryMethod || 'STANDARD_HOME',
          fulfillmentType: isShowroomPickup ? 'SHOWROOM_PICKUP' : 'DELIVERY',
          deliveryCompanyId: isShowroomPickup ? null : selectedQuote?.companyId || null,
          deliveryMethodType: isShowroomPickup
            ? null
            : (selectedQuote?.method as DeliveryCalculationMethod) || null,
          deliveryDistanceKm:
            !isShowroomPickup && selectedQuote?.distanceKm !== undefined
              ? new Decimal(selectedQuote.distanceKm)
              : null,
          deliveryTotalWeightKg:
            !isShowroomPickup && selectedQuote?.totalWeightKg !== undefined
              ? new Decimal(selectedQuote.totalWeightKg)
              : null,
          pickupShowroomId: isShowroomPickup ? pickupShowroom?.id || null : null,
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
              comment: isShowroomPickup
                ? `Retrait Showroom (${pickupShowroom?.name})${
                    transferRequestsNeeded.size > 0
                      ? ' — Demande de transfert interne inter-dépôts créée'
                      : ' — Stock disponible en showroom'
                  }`
                : `Commande en livraison${selectedQuote ? ` (${selectedQuote.name})` : ''}`,
            },
          },
        },
        include: {
          items: true,
          deliveryCompany: { select: { id: true, name: true, code: true, defaultMethod: true } },
          pickupShowroom: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Create DB Delivery tracking record if using DeliveryCompany
      if (!isShowroomPickup && selectedQuote?.companyId) {
        const blRef = await allocateSystemDocumentReference(tx, 'BL', '{PREFIX}-{YY}{MM}-{SEQ4}');
        await tx.delivery.create({
          data: {
            orderId: newOrder.id,
            companyId: selectedQuote.companyId,
            trackingNumber: blRef,
            status: DeliveryStatus.ASSIGNED,
            notes: `Calcul ${selectedQuote.method} (${selectedQuote.matchedBracketLabel || 'Standard'})`,
          },
        });
      }

      // Create Pending Internal Transfer Requests & Notifications for Showroom Pickup shortfalls
      const createdTransfers: any[] = [];
      if (isShowroomPickup && pickupShowroom && transferRequestsNeeded.size > 0) {
        for (const [fromWhId, reqItems] of transferRequestsNeeded.entries()) {
          const requestRef = await allocateSystemDocumentReference(tx, 'DTR', '{PREFIX}-{YYYY}-{SEQ4}');
          const trfRef = await allocateSystemDocumentReference(tx, 'TRF', '{PREFIX}-{YYYY}-{SEQ4}');
          const fromWh = await tx.warehouse.findUnique({ where: { id: fromWhId } });

          const transfer = await tx.stockTransfer.create({
            data: {
              reference: trfRef,
              requestRef,
              requestType: 'SHOWROOM_PICKUP',
              orderId: newOrder.id,
              showroomId: pickupShowroom.id,
              fromWarehouseId: fromWhId,
              toWarehouseId: pickupShowroom.warehouseId,
              status: StockTransferStatus.PENDING,
              requestedBy: userId || dto.guestInfo?.email || 'CHECKOUT_CLIENT',
              notes: `Réassort automatique pour commande ${reference} — Retrait showroom ${pickupShowroom.name}`,
              items: {
                create: reqItems.map((ri) => ({
                  variantId: ri.variantId,
                  requestedQty: ri.requestedQty,
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

          await tx.notification.create({
            data: {
              type: NotificationType.TRANSFER_REQUEST,
              title: `Demande de transfert Showroom (${requestRef})`,
              body: `Commande ${reference} (${pickupShowroom.name}) : transfert requis de ${reqItems
                .map((x) => `${x.requestedQty}x ${x.productName}`)
                .join(', ')} depuis ${fromWh?.name || fromWhId} vers ${
                pickupShowroom.warehouse?.name || pickupShowroom.warehouseId
              }.`,
              link: `/dashboard/transfers/${transfer.id}`,
              metadata: {
                channel: 'STOCK',
                severity: 'WARNING',
                targetRoles: 'ROOT / SUPER_ADMIN / WEBSITE_MANAGER',
                transferId: transfer.id,
                orderId: newOrder.id,
                orderReference: reference,
                requestRef,
                bonRef: trfRef,
              },
            },
          });

          createdTransfers.push(transfer);
        }
      }

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

      return {
        ...newOrder,
        transferRequests: createdTransfers,
      };
    });

    return {
      ...createdOrder,
      confirmationToken: generateOrderProofToken(createdOrder.id, createdOrder.reference),
    };
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
      return this.findAll({ ...query, customerId });
    }

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
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
          deliveryCompany: { select: { id: true, name: true, code: true, defaultMethod: true } },
          pickupShowroom: { select: { id: true, name: true, code: true } },
          stockTransfers: {
            select: { id: true, reference: true, requestRef: true, status: true },
          },
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

  private maskContactEmail(raw?: string | null): string | null {
    const val = String(raw || '').trim();
    const at = val.indexOf('@');
    if (at <= 1) return val ? '***' : null;
    return `${val[0]}***${val.slice(at)}`;
  }

  private maskContactPhone(raw?: string | null): string | null {
    const val = String(raw || '').trim();
    if (!val) return null;
    return val.length <= 4 ? '***' : `***${val.slice(-4)}`;
  }

  async findOne(
    idOrReference: string,
    accessContext?: { user?: any; proofToken?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrReference }, { reference: idOrReference }],
      },
      include: {
        customer: { select: { id: true, userId: true, firstName: true, lastName: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, nameAr: true, slug: true } },
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        payments: true,
        delivery: { include: { company: { select: { id: true, name: true, code: true } } } },
        deliveryCompany: { select: { id: true, name: true, code: true, defaultMethod: true } },
        pickupShowroom: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
        stockTransfers: {
          include: {
            fromWarehouse: { select: { id: true, name: true, code: true } },
            toWarehouse: { select: { id: true, name: true, code: true } },
          },
        },
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Commande introuvable : ${idOrReference}`);
    }

    if (!accessContext) {
      return order;
    }

    const user = accessContext.user;
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isStaff = roles.some((r) => r && r !== 'CLIENT');
    if (isStaff) {
      return order;
    }

    const userEmail = String(user?.email || '').trim().toLowerCase();
    const isOwner = Boolean(
      user &&
        ((order.customer?.userId && order.customer.userId === user.id) ||
          (userEmail && order.customer?.email?.toLowerCase() === userEmail) ||
          (userEmail && order.guestEmail?.toLowerCase() === userEmail)),
    );
    if (isOwner) {
      return order;
    }

    if (verifyOrderProofToken(order.id, order.reference, accessContext.proofToken)) {
      return {
        id: order.id,
        reference: order.reference,
        status: order.status,
        channel: order.channel,
        fulfillmentType: order.fulfillmentType,
        deliveryMethodId: order.deliveryMethodId,
        paymentMethod: order.payments?.[0]?.method || null,
        subtotalAmount: order.subtotalAmount,
        discountAmount: order.discountAmount,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        couponCode: order.couponCode,
        createdAt: order.createdAt,
        guestName: order.guestName,
        guestEmail: this.maskContactEmail(order.guestEmail || order.customer?.email),
        guestPhone: this.maskContactPhone(order.guestPhone || order.customer?.phone),
        deliveryCompany: order.deliveryCompany,
        pickupShowroom: order.pickupShowroom
          ? { id: order.pickupShowroom.id, name: order.pickupShowroom.name, code: order.pickupShowroom.code, address: order.pickupShowroom.address }
          : null,
        items: order.items,
        statusHistory: order.statusHistory.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          createdAt: h.createdAt,
        })),
        payments: (order.payments || []).map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          status: p.status,
        })),
        confirmationToken: generateOrderProofToken(order.id, order.reference),
      };
    }

    if (!user) {
      throw new UnauthorizedException('Authentification ou jeton de confirmation requis pour consulter cette commande.');
    }
    throw new ForbiddenException('Vous n’êtes pas autorisé à consulter cette commande.');
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
                tx,
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

  async trackGuestOrder(reference?: string, emailOrPhone?: string) {
    const cleanRef = String(reference || '').trim().toUpperCase();
    const cleanContact = String(emailOrPhone || '').trim().toLowerCase();
    if (!cleanRef || cleanContact.length < 4) {
      throw new BadRequestException('Référence de commande et contact (e-mail ou téléphone d’au moins 4 caractères) requis.');
    }

    const digits = cleanContact.replace(/\D+/g, '');
    const contactFilters: any[] = [
      { guestEmail: { equals: cleanContact, mode: 'insensitive' } },
      { customer: { email: { equals: cleanContact, mode: 'insensitive' } } },
    ];
    if (digits.length >= 6) {
      contactFilters.push(
        { guestPhone: { endsWith: digits.slice(-8) } },
        { customer: { phone: { endsWith: digits.slice(-8) } } },
      );
    }

    const order = await this.prisma.order.findFirst({
      where: {
        reference: cleanRef,
        isDeleted: false,
        OR: contactFilters,
      },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        payments: {
          select: { id: true, amount: true, currency: true, method: true, status: true },
        },
        deliveryCompany: { select: { id: true, name: true, code: true } },
        pickupShowroom: { select: { id: true, name: true, code: true, address: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Aucune commande correspondante trouvée.');
    }

    return {
      ...order,
      guestEmail: this.maskContactEmail(order.guestEmail),
      guestPhone: this.maskContactPhone(order.guestPhone),
      confirmationToken: generateOrderProofToken(order.id, order.reference),
    };
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
