import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { DeliveryCalculationMethod } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CalculateDeliveryQuoteDto,
  CheckShowroomsAvailabilityDto,
  UpsertDeliveryCompanyDto,
} from './dto/delivery-company.dto';
import {
  computePointAToPointBDistanceKm,
  COUNTRY_STATE_CATALOG,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_DISTANCE_BRACKETS,
  DEFAULT_WEIGHT_BRACKETS,
  ensureDefaultDeliveryCompanies,
  ensureDeliverySystemDocumentDefaults,
  evaluateBracketPrice,
  loadDeliverySettings,
  sanitizeBrackets,
  SystemDeliverySettings,
} from './delivery-pricing.helper';

@Injectable()
export class DeliveriesService implements OnModuleInit {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await ensureDefaultDeliveryCompanies(this.prisma);
      await ensureDeliverySystemDocumentDefaults(this.prisma);
    } catch (err: any) {
      this.logger.warn(`Delivery init skipped: ${err?.message || err}`);
    }
  }

  getGeographyCatalog() {
    return {
      countries: COUNTRY_STATE_CATALOG,
    };
  }

  async getDeliverySettings(): Promise<SystemDeliverySettings> {
    return loadDeliverySettings(this.prisma);
  }

  async updateDeliverySettings(payload: Partial<SystemDeliverySettings>) {
    const current = await loadDeliverySettings(this.prisma);
    const next: SystemDeliverySettings = {
      ...current,
      defaultItemWeightKg:
        payload.defaultItemWeightKg !== undefined
          ? Math.max(0.05, Number(payload.defaultItemWeightKg))
          : current.defaultItemWeightKg,
      applyFreeShippingThreshold:
        payload.applyFreeShippingThreshold !== undefined
          ? Boolean(payload.applyFreeShippingThreshold)
          : current.applyFreeShippingThreshold,
      freeShippingMigrationApplied: true,
      outOfRangeBehavior:
        payload.outOfRangeBehavior === 'UNAVAILABLE' || payload.outOfRangeBehavior === 'FALLBACK_FIXED'
          ? payload.outOfRangeBehavior
          : current.outOfRangeBehavior,
      autoCreateShowroomTransfer:
        payload.autoCreateShowroomTransfer !== undefined
          ? Boolean(payload.autoCreateShowroomTransfer)
          : current.autoCreateShowroomTransfer,
      defaultTransferAcceptanceMode:
        payload.defaultTransferAcceptanceMode &&
        ['CHOICE', 'IMMEDIATE', 'STEP_BY_STEP'].includes(payload.defaultTransferAcceptanceMode)
          ? payload.defaultTransferAcceptanceMode
          : current.defaultTransferAcceptanceMode,
      customDistances: Array.isArray(payload.customDistances)
        ? payload.customDistances
            .filter((d) => d && d.fromState && d.toState && Number.isFinite(Number(d.distanceKm)))
            .map((d, idx) => ({
              id: d.id || `dist-${Date.now()}-${idx}`,
              fromCountry: String(d.fromCountry || 'TN').toUpperCase(),
              fromState: String(d.fromState).trim(),
              toCountry: String(d.toCountry || 'TN').toUpperCase(),
              toState: String(d.toState).trim(),
              distanceKm: Math.max(0, Number(d.distanceKm)),
              bidirectional: d.bidirectional !== false,
            }))
        : current.customDistances,
    };

    await this.prisma.settings.upsert({
      where: { key: 'sys.deliverySettings' },
      update: { value: JSON.stringify(next), group: 'system' },
      create: { key: 'sys.deliverySettings', value: JSON.stringify(next), group: 'system' },
    });
    return next;
  }

  async listCompanies(activeOnly = false) {
    const companies = await this.prisma.deliveryCompany.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: {
        pricingMethods: {
          orderBy: { method: 'asc' },
        },
        _count: {
          select: { deliveries: true, orders: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return companies.map((c) => this.serializeCompany(c));
  }

  async createCompany(dto: UpsertDeliveryCompanyDto) {
    const cleanName = dto.name.trim();
    if (!cleanName) throw new BadRequestException('Le nom de la société de livraison est requis.');
    const rawCode = (dto.code || cleanName)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const code = rawCode || `CARRIER-${Date.now()}`;

    const existing = await this.prisma.deliveryCompany.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException(`Le code société ${code} existe déjà.`);
    }

    const defaultMethod = dto.defaultMethod || DeliveryCalculationMethod.DISTANCE;
    const fixedPrice = Math.max(0, Number(dto.fixedPrice ?? 7));
    const methodRules = this.normalizeMethodRules(dto.methods, defaultMethod, fixedPrice);

    const created = await this.prisma.deliveryCompany.create({
      data: {
        name: cleanName,
        code,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        logoUrl: dto.logoUrl?.trim() || null,
        originCountry: (dto.originCountry || 'TN').toUpperCase(),
        originState: dto.originState?.trim() || 'Tunis',
        originCity: dto.originCity?.trim() || null,
        estimatedDays: dto.estimatedDays?.trim() || '24h - 48h',
        defaultMethod,
        fixedPrice,
        isActive: dto.isActive !== false,
        pricingMethods: {
          create: methodRules.map((m) => ({
            method: m.method,
            isEnabled: m.isEnabled,
            isDefault: m.method === defaultMethod,
            fixedPrice: m.fixedPrice,
            bracketsJson: m.brackets as any,
          })),
        },
      },
      include: {
        pricingMethods: true,
        _count: { select: { deliveries: true, orders: true } },
      },
    });

    return this.serializeCompany(created);
  }

  async updateCompany(id: string, dto: Partial<UpsertDeliveryCompanyDto>) {
    const existing = await this.prisma.deliveryCompany.findUnique({
      where: { id },
      include: { pricingMethods: true },
    });
    if (!existing) throw new NotFoundException('Société de livraison introuvable.');

    const defaultMethod = dto.defaultMethod || existing.defaultMethod;
    const fixedPrice =
      dto.fixedPrice !== undefined ? Math.max(0, Number(dto.fixedPrice)) : Number(existing.fixedPrice);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.deliveryCompany.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined
            ? {
                code: dto.code
                  .trim()
                  .toUpperCase()
                  .replace(/[^A-Z0-9]+/g, '-'),
              }
            : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
          ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl?.trim() || null } : {}),
          ...(dto.originCountry !== undefined
            ? { originCountry: dto.originCountry.trim().toUpperCase() }
            : {}),
          ...(dto.originState !== undefined ? { originState: dto.originState.trim() } : {}),
          ...(dto.originCity !== undefined ? { originCity: dto.originCity?.trim() || null } : {}),
          ...(dto.estimatedDays !== undefined ? { estimatedDays: dto.estimatedDays.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          defaultMethod,
          fixedPrice,
        },
      });

      if (Array.isArray(dto.methods)) {
        const methodRules = this.normalizeMethodRules(dto.methods, defaultMethod, fixedPrice);
        for (const rule of methodRules) {
          await tx.deliveryCompanyMethod.upsert({
            where: { companyId_method: { companyId: id, method: rule.method } },
            update: {
              isEnabled: rule.isEnabled,
              isDefault: rule.method === defaultMethod,
              fixedPrice: rule.fixedPrice,
              bracketsJson: rule.brackets as any,
            },
            create: {
              companyId: id,
              method: rule.method,
              isEnabled: rule.isEnabled,
              isDefault: rule.method === defaultMethod,
              fixedPrice: rule.fixedPrice,
              bracketsJson: rule.brackets as any,
            },
          });
        }
      } else if (dto.defaultMethod) {
        await tx.deliveryCompanyMethod.updateMany({
          where: { companyId: id },
          data: { isDefault: false },
        });
        await tx.deliveryCompanyMethod.updateMany({
          where: { companyId: id, method: defaultMethod },
          data: { isDefault: true, isEnabled: true },
        });
      }

      return tx.deliveryCompany.findUniqueOrThrow({
        where: { id },
        include: {
          pricingMethods: { orderBy: { method: 'asc' } },
          _count: { select: { deliveries: true, orders: true } },
        },
      });
    });

    return this.serializeCompany(updated);
  }

  async toggleCompanyActive(id: string) {
    const existing = await this.prisma.deliveryCompany.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Société introuvable.');
    const updated = await this.prisma.deliveryCompany.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { pricingMethods: true, _count: { select: { deliveries: true, orders: true } } },
    });
    return this.serializeCompany(updated);
  }

  async deleteCompany(id: string) {
    const existing = await this.prisma.deliveryCompany.findUnique({
      where: { id },
      include: { _count: { select: { orders: true, deliveries: true } } },
    });
    if (!existing) throw new NotFoundException('Société introuvable.');
    if (existing._count.orders > 0 || existing._count.deliveries > 0) {
      await this.prisma.deliveryCompany.update({ where: { id }, data: { isActive: false } });
      return {
        deactivatedOnly: true,
        message: 'Société désactivée (déjà associée à des commandes/expéditions existantes).',
      };
    }
    await this.prisma.deliveryCompany.delete({ where: { id } });
    return { deleted: true, id };
  }

  async resolveCartTotalWeightKg(
    items: Array<{ variantId: string; quantity: number }>,
    defaultItemWeightKg = 1,
  ): Promise<number> {
    if (!items || items.length === 0) return defaultItemWeightKg;
    const variantIds = Array.from(new Set(items.map((i) => i.variantId).filter(Boolean)));
    if (variantIds.length === 0) return defaultItemWeightKg;

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        product: { select: { weight: true } },
      },
    });
    const weightMap = new Map<string, number>();
    for (const v of variants) {
      const w = Number(v.product?.weight || 0);
      weightMap.set(v.id, w > 0 ? w : defaultItemWeightKg);
    }

    let total = 0;
    for (const item of items) {
      const unitW = weightMap.get(item.variantId) ?? defaultItemWeightKg;
      total += unitW * Math.max(1, Number(item.quantity || 1));
    }
    return Number(total.toFixed(3));
  }

  async calculateDeliveryQuotes(dto: CalculateDeliveryQuoteDto) {
    const settings = await loadDeliverySettings(this.prisma);
    const totalWeightKg =
      dto.totalWeightKg !== undefined
        ? Math.max(0, Number(dto.totalWeightKg))
        : await this.resolveCartTotalWeightKg(dto.items || [], settings.defaultItemWeightKg);

    const destCountry = (dto.destinationCountry || 'TN').trim().toUpperCase();
    const destState = (dto.destinationState || 'Tunis').trim();

    let thresholdReached = false;
    if (settings.applyFreeShippingThreshold && dto.subtotalTnd !== undefined) {
      const thrSetting = await this.prisma.settings.findUnique({
        where: { key: 'shipping.free_threshold' },
      });
      const thr = Number(thrSetting?.value ?? 150);
      if (Number(dto.subtotalTnd) >= thr && Number(dto.subtotalTnd) > 0) {
        thresholdReached = true;
      }
    }
    const freeShippingActive = Boolean(dto.freeShippingCoupon) || thresholdReached;
    const freeShippingReason = dto.freeShippingCoupon
      ? 'COUPON'
      : thresholdReached
        ? 'THRESHOLD'
        : null;

    const companies = await this.prisma.deliveryCompany.findMany({
      where: dto.includeInactive ? {} : { isActive: true },
      include: { pricingMethods: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const quotes = companies.map((company) => {
      const serialized = this.serializeCompany(company);
      const distanceKm = computePointAToPointBDistanceKm(
        company.originCountry,
        company.originState,
        destCountry,
        destState,
        settings.customDistances,
      );

      const defaultRule =
        serialized.methods.find((m) => m.method === company.defaultMethod) ||
        serialized.methods[0];

      let price: number | null = null;
      let matchedLabel = '';
      let usedFallback = false;

      if (company.defaultMethod === DeliveryCalculationMethod.FIXED) {
        price = Number(defaultRule?.fixedPrice ?? company.fixedPrice ?? 0);
        matchedLabel = 'Tarif fixe';
      } else if (company.defaultMethod === DeliveryCalculationMethod.DISTANCE) {
        const res = evaluateBracketPrice(distanceKm, defaultRule?.brackets);
        if (res.price !== null) {
          price = res.price;
          matchedLabel =
            res.matched?.label ||
            `${res.matched?.min ?? 0} – ${res.matched?.max ?? '∞'} km`;
        }
      } else if (company.defaultMethod === DeliveryCalculationMethod.WEIGHT) {
        const res = evaluateBracketPrice(totalWeightKg, defaultRule?.brackets);
        if (res.price !== null) {
          price = res.price;
          matchedLabel =
            res.matched?.label ||
            `${res.matched?.min ?? 0} – ${res.matched?.max ?? '∞'} kg`;
        }
      }

      if (price === null && settings.outOfRangeBehavior === 'FALLBACK_FIXED') {
        const fixedRule = serialized.methods.find((m) => m.method === DeliveryCalculationMethod.FIXED);
        price = Number(fixedRule?.fixedPrice ?? company.fixedPrice ?? 0);
        matchedLabel = 'Tarif fixe (secours hors plage)';
        usedFallback = true;
      }

      const finalFee = freeShippingActive ? 0 : price;

      return {
        companyId: company.id,
        code: company.code,
        name: company.name,
        logoUrl: company.logoUrl,
        phone: company.phone,
        isActive: company.isActive,
        estimatedDays: company.estimatedDays,
        originCountry: company.originCountry,
        originState: company.originState,
        destinationCountry: destCountry,
        destinationState: destState,
        method: company.defaultMethod,
        distanceKm,
        totalWeightKg,
        matchedBracketLabel: freeShippingActive
          ? dto.freeShippingCoupon
            ? 'Livraison offerte (Code promo)'
            : 'Livraison gratuite (seuil atteint)'
          : matchedLabel,
        usedFallback,
        available: finalFee !== null,
        originalFeeTnd: price !== null ? Number(Number(price).toFixed(3)) : null,
        feeTnd: finalFee !== null ? Number(Number(finalFee).toFixed(3)) : null,
      };
    });

    return {
      destinationCountry: destCountry,
      destinationState: destState,
      totalWeightKg,
      freeShippingActive,
      freeShippingReason,
      quotes,
    };
  }

  async checkShowroomsAvailability(dto: CheckShowroomsAvailabilityDto) {
    const showrooms = await this.prisma.pointOfSale.findMany({
      where: { isActive: true },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true, city: true, address: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const variantIds = Array.from(new Set(dto.items.map((i) => i.variantId).filter(Boolean)));
    const stocks = await this.prisma.stock.findMany({
      where: { variantId: { in: variantIds } },
      include: {
        warehouse: { select: { id: true, name: true, code: true, isActive: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const results = showrooms.map((pos) => {
      const shortfalls: Array<{
        variantId: string;
        sku: string;
        productName: string;
        requestedQty: number;
        availableAtShowroom: number;
        missingQty: number;
        sourceWarehouseId: string | null;
        sourceWarehouseName: string | null;
      }> = [];

      for (const reqItem of dto.items) {
        const localStock = stocks.find(
          (s) => s.variantId === reqItem.variantId && s.warehouseId === pos.warehouseId,
        );
        const availableLocal = Math.max(0, Number(localStock?.physicalQty || 0));
        if (availableLocal < reqItem.quantity) {
          const missingQty = reqItem.quantity - availableLocal;
          const donor =
            stocks
              .filter(
                (s) =>
                  s.variantId === reqItem.variantId &&
                  s.warehouseId !== pos.warehouseId &&
                  s.warehouse?.isActive &&
                  s.physicalQty >= missingQty,
              )
              .sort((a, b) => b.physicalQty - a.physicalQty)[0] ||
            stocks.find(
              (s) =>
                s.variantId === reqItem.variantId &&
                s.warehouseId !== pos.warehouseId &&
                s.warehouse?.isActive &&
                s.physicalQty > 0,
            );

          shortfalls.push({
            variantId: reqItem.variantId,
            sku: localStock?.variant?.sku || donor?.variant?.sku || reqItem.variantId,
            productName:
              localStock?.variant?.product?.name ||
              donor?.variant?.product?.name ||
              'Article',
            requestedQty: reqItem.quantity,
            availableAtShowroom: availableLocal,
            missingQty,
            sourceWarehouseId: donor?.warehouseId || null,
            sourceWarehouseName: donor?.warehouse?.name || null,
          });
        }
      }

      const inShowroomStock = shortfalls.length === 0;
      return {
        id: pos.id,
        code: pos.code,
        name: pos.name,
        address: pos.address || pos.warehouse?.address || '',
        city: pos.warehouse?.city || '',
        phone: pos.phone || '',
        warehouseId: pos.warehouseId,
        warehouseName: pos.warehouse?.name || '',
        warehouseCode: pos.warehouse?.code || '',
        inShowroomStock,
        requiresTransferRequest: !inShowroomStock,
        shortfalls,
      };
    });

    return { showrooms: results };
  }

  async listDbDeliveries() {
    return this.prisma.delivery.findMany({
      include: {
        company: { select: { id: true, name: true, code: true, defaultMethod: true } },
        order: {
          select: {
            id: true,
            reference: true,
            totalAmount: true,
            shippingAmount: true,
            status: true,
            fulfillmentType: true,
            shippingAddressJson: true,
            guestName: true,
            guestPhone: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private normalizeMethodRules(
    rawMethods: any[] | undefined,
    defaultMethod: DeliveryCalculationMethod,
    fixedPrice: number,
  ) {
    const map = new Map<DeliveryCalculationMethod, any>();
    for (const m of rawMethods || []) {
      if (m?.method && Object.values(DeliveryCalculationMethod).includes(m.method)) {
        map.set(m.method, m);
      }
    }

    const distanceInput = map.get(DeliveryCalculationMethod.DISTANCE);
    const weightInput = map.get(DeliveryCalculationMethod.WEIGHT);
    const fixedInput = map.get(DeliveryCalculationMethod.FIXED);

    return [
      {
        method: DeliveryCalculationMethod.DISTANCE,
        isEnabled:
          distanceInput?.isEnabled !== undefined
            ? Boolean(distanceInput.isEnabled)
            : true,
        isDefault: defaultMethod === DeliveryCalculationMethod.DISTANCE,
        fixedPrice: null,
        brackets:
          distanceInput?.brackets !== undefined
            ? sanitizeBrackets(distanceInput.brackets)
            : DEFAULT_DISTANCE_BRACKETS,
      },
      {
        method: DeliveryCalculationMethod.WEIGHT,
        isEnabled:
          weightInput?.isEnabled !== undefined ? Boolean(weightInput.isEnabled) : true,
        isDefault: defaultMethod === DeliveryCalculationMethod.WEIGHT,
        fixedPrice: null,
        brackets:
          weightInput?.brackets !== undefined
            ? sanitizeBrackets(weightInput.brackets)
            : DEFAULT_WEIGHT_BRACKETS,
      },
      {
        method: DeliveryCalculationMethod.FIXED,
        isEnabled:
          fixedInput?.isEnabled !== undefined ? Boolean(fixedInput.isEnabled) : true,
        isDefault: defaultMethod === DeliveryCalculationMethod.FIXED,
        fixedPrice:
          fixedInput?.fixedPrice !== undefined
            ? Math.max(0, Number(fixedInput.fixedPrice))
            : fixedPrice,
        brackets: [],
      },
    ];
  }

  private serializeCompany(company: any) {
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      phone: company.phone,
      email: company.email,
      logoUrl: company.logoUrl,
      originCountry: company.originCountry,
      originState: company.originState,
      originCity: company.originCity,
      estimatedDays: company.estimatedDays,
      defaultMethod: company.defaultMethod,
      fixedPrice: Number(company.fixedPrice ?? 0),
      isActive: company.isActive,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      deliveriesCount: company._count?.deliveries ?? 0,
      ordersCount: company._count?.orders ?? 0,
      methods: (company.pricingMethods || []).map((pm: any) => ({
        id: pm.id,
        method: pm.method,
        isEnabled: pm.isEnabled,
        isDefault: pm.method === company.defaultMethod || pm.isDefault,
        fixedPrice: pm.fixedPrice !== null && pm.fixedPrice !== undefined ? Number(pm.fixedPrice) : Number(company.fixedPrice ?? 0),
        brackets: sanitizeBrackets(pm.bracketsJson),
      })),
    };
  }
}
