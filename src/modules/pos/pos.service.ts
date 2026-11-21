import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePointOfSaleDto } from './dto/create-pos.dto';
import { CreateCashRegisterDto } from './dto/create-register.dto';
import { OpenSessionDto, CloseSessionDto, CashMovementDto } from './dto/session-actions.dto';
import { PosCheckoutDto, PosPaymentMethod } from './dto/pos-checkout.dto';
import { CashMovementType, OrderChannel, OrderStatus, StockMovementType } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // 1. Points of Sale (POS)
  async findAllPos() {
    return this.prisma.pointOfSale.findMany({
      orderBy: { name: 'asc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        cashRegisters: {
          include: {
            sessions: {
              where: { closedAt: null },
              take: 1,
            },
          },
        },
      },
    });
  }

  async createPos(dto: CreatePointOfSaleDto) {
    const existing = await this.prisma.pointOfSale.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Le code point de vente ${dto.code} existe déjà.`);
    }

    return this.prisma.pointOfSale.create({
      data: dto,
      include: { warehouse: true },
    });
  }

  // 2. Cash Registers
  async findAllRegisters(posId?: string) {
    const where: any = {};
    if (posId) where.posId = posId;

    const registers = await this.prisma.cashRegister.findMany({
      where,
      include: {
        pos: { select: { id: true, name: true, code: true, warehouseId: true } },
        sessions: {
          where: { closedAt: null },
          take: 1,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    return registers.map((reg) => {
      const activeSession = reg.sessions?.[0] || null;
      return {
        id: reg.id,
        name: reg.name,
        posId: reg.posId,
        posName: reg.pos.name,
        warehouseId: reg.pos.warehouseId,
        isActive: reg.isActive,
        hasActiveSession: !!activeSession,
        activeSession: activeSession
          ? {
              id: activeSession.id,
              cashierId: activeSession.cashierId,
              openingBalance: Number(activeSession.openingBalance),
              openedAt: activeSession.openedAt,
            }
          : null,
      };
    });
  }

  async createRegister(dto: CreateCashRegisterDto) {
    return this.prisma.cashRegister.create({
      data: dto,
      include: { pos: true },
    });
  }

  // 3. Cash Register Sessions
  async getCurrentSession(registerId: string) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { registerId, closedAt: null },
      orderBy: { openedAt: 'desc' },
      include: {
        register: { include: { pos: true } },
        movements: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!session) {
      return null;
    }

    // Calculate current running total in drawer
    let cashSalesTotal = new Decimal(0);
    let cashInTotal = new Decimal(session.openingBalance.toString());
    let cashOutTotal = new Decimal(0);

    for (const mov of session.movements) {
      const amt = new Decimal(mov.amount.toString());
      if (mov.type === CashMovementType.SALE) {
        cashSalesTotal = cashSalesTotal.plus(amt);
        cashInTotal = cashInTotal.plus(amt);
      } else if (mov.type === CashMovementType.DEPOSIT) {
        cashInTotal = cashInTotal.plus(amt);
      } else if (mov.type === CashMovementType.WITHDRAWAL || mov.type === CashMovementType.EXPENSE) {
        cashOutTotal = cashOutTotal.plus(amt);
      }
    }

    const expectedCurrentCash = cashInTotal.minus(cashOutTotal);

    return {
      id: session.id,
      registerId: session.registerId,
      registerName: session.register.name,
      posName: session.register.pos.name,
      warehouseId: session.register.pos.warehouseId,
      cashierId: session.cashierId,
      openedAt: session.openedAt,
      openingBalance: Number(session.openingBalance),
      currentExpectedCash: expectedCurrentCash.toNumber(),
      movementsCount: session.movements.length,
      movements: session.movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        description: m.description,
        createdAt: m.createdAt,
      })),
    };
  }

  async openSession(registerId: string, dto: OpenSessionDto, cashierId: string) {
    const existingActive = await this.prisma.cashRegisterSession.findFirst({
      where: { registerId, closedAt: null },
    });

    if (existingActive) {
      throw new ConflictException('Une session de caisse est déjà active et ouverte sur ce poste.');
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cashRegisterSession.create({
        data: {
          registerId,
          cashierId,
          openingBalance: new Decimal(dto.openingBalance),
          notes: dto.notes,
        },
      });

      // Log opening float movement
      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: CashMovementType.OPENING,
          amount: new Decimal(dto.openingBalance),
          description: 'Fond de caisse initial',
        },
      });

      return session;
    });
  }

  async closeSession(sessionId: string, dto: CloseSessionDto, cashierId: string) {
    const session = await this.prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: { movements: true },
    });

    if (!session) {
      throw new NotFoundException('Session de caisse introuvable.');
    }

    if (session.closedAt) {
      throw new BadRequestException('Cette session de caisse est déjà clôturée.');
    }

    // Calculate theoretical cash expected
    let expected = new Decimal(session.openingBalance.toString());
    for (const mov of session.movements) {
      const amt = new Decimal(mov.amount.toString());
      if (mov.type === CashMovementType.SALE || mov.type === CashMovementType.DEPOSIT) {
        expected = expected.plus(amt);
      } else if (mov.type === CashMovementType.WITHDRAWAL || mov.type === CashMovementType.EXPENSE) {
        expected = expected.minus(amt);
      }
    }

    const actual = new Decimal(dto.closingBalance);
    const discrepancy = actual.minus(expected);

    return this.prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        closedAt: new Date(),
        closingBalance: actual,
        expectedBalance: expected,
        discrepancy,
        notes: dto.notes,
      },
      include: {
        register: { include: { pos: true } },
      },
    });
  }

  async addMovement(sessionId: string, dto: CashMovementDto) {
    const session = await this.prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.closedAt) {
      throw new BadRequestException('La session de caisse n’existe pas ou est déjà fermée.');
    }

    return this.prisma.cashMovement.create({
      data: {
        sessionId,
        type: dto.type,
        amount: new Decimal(dto.amount),
        description: dto.description,
      },
    });
  }

  // 4. POS Checkout & Sales Execution
  async checkout(dto: PosCheckoutDto, cashierId: string) {
    // 1. Resolve cash register / active session & cashier identity
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: dto.registerId },
      include: { pos: true },
    });
    if (!register) {
      throw new NotFoundException('Caisse enregistreuse introuvable.');
    }

    const activeSession = await this.prisma.cashRegisterSession.findFirst({
      where: { registerId: dto.registerId, closedAt: null },
    });

    const cashierUser = await this.prisma.user.findUnique({
      where: { id: cashierId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const cashierLabel = cashierUser
      ? `${cashierUser.firstName} ${cashierUser.lastName}`.trim() || cashierUser.email
      : cashierId;

    const pos = register.pos;
    const warehouseId = pos.warehouseId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le panier de vente est vide.');
    }

    // 2. Calculate amounts and totals
    let totalGross = new Decimal(0);
    let totalDiscount = new Decimal(0);
    const itemsDetails: any[] = [];

    for (const item of dto.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1, select: { url: true } },
            },
          },
        },
      });

      if (!variant) {
        throw new NotFoundException(`Variante de produit introuvable : ${item.variantId}`);
      }

      const unitPrice = new Decimal(item.unitPrice);
      const discount = new Decimal(item.discount || 0);
      const lineTotal = unitPrice.times(item.quantity).minus(discount);

      totalGross = totalGross.plus(unitPrice.times(item.quantity));
      totalDiscount = totalDiscount.plus(discount);

      itemsDetails.push({
        productId: variant.productId,
        variantId: item.variantId,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variant.name,
        imageUrl: variant.product.images?.[0]?.url || null,
        name: `${variant.product.name} — ${variant.name}`,
        quantity: item.quantity,
        unitPrice: unitPrice.toNumber(),
        discount: discount.toNumber(),
        taxRate: Number(variant.product.taxRate || 0.19),
        lineTotal: lineTotal.toNumber(),
      });
    }

    const netPayable = totalGross.minus(totalDiscount);

    // 3. Verify payment amounts
    let totalPaid = new Decimal(0);
    let cashPaid = new Decimal(0);

    for (const pay of dto.payments) {
      const pAmt = new Decimal(pay.amount);
      totalPaid = totalPaid.plus(pAmt);
      if (pay.method === PosPaymentMethod.CASH) {
        cashPaid = cashPaid.plus(pAmt);
      }
    }

    if (totalPaid.lessThan(netPayable)) {
      throw new BadRequestException(
        `Montant réglé insuffisant. Total à payer : ${netPayable.toNumber()} TND, Payé : ${totalPaid.toNumber()} TND`,
      );
    }

    const changeGiven =
      dto.amountTendered && dto.amountTendered > netPayable.toNumber()
        ? new Decimal(dto.amountTendered).minus(netPayable).toNumber()
        : 0;

    const receiptNumber = `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const mappedStatus: OrderStatus =
      dto.fulfillmentMode === 'PENDING_PICKUP'
        ? OrderStatus.READY_FOR_SHIPMENT
        : dto.fulfillmentMode === 'DELIVERY'
          ? OrderStatus.CONFIRMED
          : OrderStatus.DELIVERED;

    // 4. Atomic stock decrement, cash ledger & persistent Order record
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        let stock = await tx.stock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId,
            },
          },
        });

        if (!stock) {
          stock = await tx.stock.findFirst({
            where: {
              variantId: item.variantId,
              physicalQty: { gte: item.quantity },
            },
            orderBy: { physicalQty: 'desc' },
          });
        }

        if (stock && stock.physicalQty - stock.reservedQty >= item.quantity) {
          const before = stock.physicalQty;
          const after = before - item.quantity;
          await tx.stockMovement.create({
            data: {
              stockId: stock.id,
              type: StockMovementType.SALE_OUT,
              quantityDelta: -item.quantity,
              quantityBefore: before,
              quantityAfter: after,
              referenceType: 'POS_SALE',
              referenceId: receiptNumber,
              reason: `Vente POS ${pos.name} (${receiptNumber})`,
              performedBy: cashierLabel,
            },
          });
          await tx.stock.update({
            where: { id: stock.id },
            data: { physicalQty: after },
          });
        }
      }

      if (activeSession && cashPaid.greaterThan(0)) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeSession.id,
            type: CashMovementType.SALE,
            amount: cashPaid,
            referenceId: receiptNumber,
            description: `Vente comptoir ticket ${receiptNumber} (${cashierLabel})`,
          },
        });
      }

      const taxAmount = netPayable.times(0.19);
      const subtotalHT = netPayable.minus(taxAmount);

      const order = await tx.order.create({
        data: {
          reference: receiptNumber,
          customerId: dto.customerId || null,
          guestName: dto.customerName || 'Client Showroom',
          guestPhone: dto.customerPhone || null,
          guestEmail: dto.customerEmail || null,
          guestData: {
            showroomId: pos.id,
            showroomName: pos.name,
            showroomCode: pos.code,
            registerId: register.id,
            registerName: register.name,
            cashierId,
            cashierName: cashierLabel,
            fulfillmentMode: dto.fulfillmentMode || 'IN_STORE_PICKUP',
            payments: dto.payments,
            amountTendered: dto.amountTendered || netPayable.toNumber(),
            changeGiven,
          } as any,
          status: mappedStatus,
          channel: OrderChannel.POS,
          subtotalAmount: subtotalHT,
          discountAmount: totalDiscount,
          taxAmount,
          shippingAmount: new Decimal(0),
          totalAmount: netPayable,
          shippingAddressJson: dto.deliveryAddress
            ? ({ address: dto.deliveryAddress, source: 'POS_DELIVERY' } as any)
            : ({ showroom: pos.name, city: pos.address || 'Mahdia' } as any),
          notes: dto.notes || `Vente POS ${pos.name} • Caisse ${register.name}`,
          confirmedAt: new Date(),
          deliveredAt: mappedStatus === OrderStatus.DELIVERED ? new Date() : null,
          createdBy: cashierLabel,
          items: {
            create: itemsDetails.map((d) => ({
              productId: d.productId,
              variantId: d.variantId,
              productName: d.productName,
              variantName: d.variantName,
              sku: d.sku,
              imageUrl: d.imageUrl,
              unitPrice: new Decimal(d.unitPrice),
              taxRate: new Decimal(d.taxRate),
              quantity: d.quantity,
              totalPrice: new Decimal(d.lineTotal),
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: mappedStatus,
              changedBy: cashierLabel,
              comment: `Commande enregistrée depuis POS ${pos.name} (${register.name})`,
            },
          },
        },
      });

      return order;
    });

    // 5. Structure thermal receipt payload
    return {
      orderId: createdOrder.id,
      receiptNumber,
      status: mappedStatus,
      dateTime: new Date().toISOString(),
      pos: {
        name: pos.name,
        code: pos.code,
        address: pos.address || 'Mahdia 5100, Tunisie',
        phone: pos.phone || '48 091 914',
      },
      register: {
        id: register.id,
        name: register.name,
        sessionActive: !!activeSession,
      },
      cashier: {
        id: cashierId,
        name: cashierLabel,
      },
      customer: {
        name: dto.customerName || 'Client Showroom',
        phone: dto.customerPhone || null,
        email: dto.customerEmail || null,
      },
      fulfillmentMode: dto.fulfillmentMode || 'IN_STORE_PICKUP',
      items: itemsDetails,
      totals: {
        gross: totalGross.toNumber(),
        discount: totalDiscount.toNumber(),
        vatAmount: netPayable.times(0.19).toNumber(),
        netPayable: netPayable.toNumber(),
      },
      payments: dto.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference,
      })),
      amountTendered: dto.amountTendered || netPayable.toNumber(),
      changeGiven,
      footer: 'Merci pour votre confiance. Royal — Électro de Maison.',
    };
  }
}
