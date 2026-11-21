import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/create-coupon.dto';
import { CouponType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.isActive !== undefined) {
      where.isActive = String(query.isActive) === 'true';
    }

    const [total, rawData] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = rawData.map((c) => ({
      ...c,
      value: Number(c.value),
      minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
      maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          take: 10,
          orderBy: { usedAt: 'desc' },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon introuvable avec l'identifiant ${id}`);
    }

    return coupon;
  }

  async create(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });

    if (existing) {
      throw new BadRequestException(`Un coupon avec le code ${dto.code} existe déjà.`);
    }

    const created = await this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        description: dto.description,
        type: dto.type,
        value: new Decimal(dto.value),
        minOrderAmount: dto.minOrderAmount ? new Decimal(dto.minOrderAmount) : null,
        maxDiscount: dto.maxDiscount ? new Decimal(dto.maxDiscount) : null,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit ?? 1,
        targetType: dto.targetType || 'ALL',
        targetIds: dto.targetIds ? (dto.targetIds as any) : null,
        minQuantity: dto.minQuantity ?? null,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    if (created.isActive) {
      const targetScope =
        created.targetType === 'CATEGORY'
          ? 'une sélection de catégories'
          : created.targetType === 'ARTICLE'
          ? 'des articles sélectionnés'
          : 'tout le catalogue Royal';
      this.prisma.user
        .findMany({
          where: {
            deletedAt: null,
            isActive: true,
            userRoles: { some: { role: { name: 'CLIENT' } } },
          },
          select: { id: true },
        })
        .then((clients) => {
          if (clients.length === 0) return;
          return this.prisma.notification.createMany({
            data: clients.map((c) => ({
              userId: c.id,
              type: 'SYSTEM' as any,
              title: `Nouvelle promotion : Code ${created.code}`,
              body: `Remise ${created.type === 'PERCENTAGE' ? `${created.value}%` : `${created.value} TND`} applicable sur ${targetScope}.`,
              link: '/articles?sortBy=promo',
              metadata: {
                channel: 'PROMO',
                severity: 'INFO',
                targetRoles: 'CLIENT',
                couponCode: created.code,
              } as any,
            })),
          });
        })
        .catch(() => null);
    }

    return created;
  }

  async update(id: string, dto: Partial<CreateCouponDto>) {
    await this.findOne(id);

    const updateData: any = { ...dto };
    if (dto.code) updateData.code = dto.code.toUpperCase().trim();
    if (dto.value !== undefined) updateData.value = new Decimal(dto.value);
    if (dto.minOrderAmount !== undefined) {
      updateData.minOrderAmount = dto.minOrderAmount ? new Decimal(dto.minOrderAmount) : null;
    }
    if (dto.maxDiscount !== undefined) {
      updateData.maxDiscount = dto.maxDiscount ? new Decimal(dto.maxDiscount) : null;
    }
    if (dto.targetIds !== undefined) {
      updateData.targetIds = dto.targetIds ? (dto.targetIds as any) : null;
    }
    if (dto.startsAt) updateData.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt) updateData.expiresAt = new Date(dto.expiresAt);

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.coupon.delete({ where: { id } });
  }

  async validate(dto: ValidateCouponDto) {
    const code = dto.code.toUpperCase().trim();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      throw new NotFoundException(`Le code promo "${code}" n'existe pas.`);
    }

    if (!coupon.isActive) {
      throw new BadRequestException(`Le code promo "${code}" est actuellement désactivé.`);
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException(`Ce code promo n'est pas encore actif.`);
    }

    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException(`Ce code promo a expiré.`);
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException(`Ce code promo a atteint sa limite maximale d'utilisations.`);
    }

    const orderAmount = new Decimal(dto.orderAmount);
    if (coupon.minOrderAmount && orderAmount.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Le montant minimum de commande pour appliquer ce coupon est de ${coupon.minOrderAmount.toNumber()} TND.`,
      );
    }

    // Enforce targetType applicability (ARTICLE, QUANTITY, CATEGORY, BRAND, CUSTOMER)
    const targetType = coupon.targetType || 'ALL';
    const targetIds: string[] = Array.isArray(coupon.targetIds)
      ? (coupon.targetIds as any[]).map((x) => String(x).trim()).filter(Boolean)
      : [];
    let eligibleAmount = orderAmount;

    if (['ARTICLE', 'QUANTITY', 'CATEGORY', 'BRAND'].includes(targetType) && targetIds.length > 0) {
      const cartItems = dto.items || [];
      if (cartItems.length === 0) {
        throw new BadRequestException(
          `Ce code promo est réservé à des articles spécifiques. Veuillez vérifier votre panier.`,
        );
      }

      const variantIds = cartItems.map((i) => i.variantId).filter(Boolean) as string[];
      const productIds = cartItems.map((i) => i.productId).filter(Boolean) as string[];

      const variants = variantIds.length
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              productId: true,
              sellingPrice: true,
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  categoryId: true,
                  brandId: true,
                  sellingPrice: true,
                  discountPrice: true,
                  category: { select: { id: true, slug: true, parentId: true } },
                  brand: { select: { id: true, slug: true, name: true } },
                },
              },
            },
          })
        : [];

      const productsById = productIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              sku: true,
              name: true,
              categoryId: true,
              brandId: true,
              sellingPrice: true,
              discountPrice: true,
              category: { select: { id: true, slug: true, parentId: true } },
              brand: { select: { id: true, slug: true, name: true } },
            },
          })
        : [];

      const variantMap = new Map(variants.map((v) => [v.id, v]));
      const prodMap = new Map(productsById.map((p) => [p.id, p]));
      const lowerTargets = targetIds.map((t) => t.toLowerCase());

      let matchedQty = 0;
      let matchedSum = new Decimal(0);

      for (const item of cartItems) {
        const vRec = item.variantId ? variantMap.get(item.variantId) : undefined;
        const prod = vRec?.product || (item.productId ? prodMap.get(item.productId) : undefined);
        if (!prod) continue;

        let isMatch = false;
        if (targetType === 'ARTICLE' || targetType === 'QUANTITY') {
          isMatch =
            lowerTargets.includes(prod.id.toLowerCase()) ||
            lowerTargets.includes(prod.sku.toLowerCase()) ||
            lowerTargets.includes(prod.name.toLowerCase());
        } else if (targetType === 'CATEGORY') {
          isMatch =
            lowerTargets.includes(prod.categoryId.toLowerCase()) ||
            (prod.category?.slug ? lowerTargets.includes(prod.category.slug.toLowerCase()) : false) ||
            (prod.category?.parentId ? lowerTargets.includes(prod.category.parentId.toLowerCase()) : false);
        } else if (targetType === 'BRAND') {
          isMatch =
            (prod.brandId ? lowerTargets.includes(prod.brandId.toLowerCase()) : false) ||
            (prod.brand?.slug ? lowerTargets.includes(prod.brand.slug.toLowerCase()) : false) ||
            (prod.brand?.name ? lowerTargets.includes(prod.brand.name.toLowerCase()) : false);
        }

        if (isMatch) {
          matchedQty += item.quantity;
          const unitP =
            item.unitPrice !== undefined
              ? new Decimal(item.unitPrice)
              : new Decimal(
                  Number(
                    vRec?.sellingPrice ?? prod.discountPrice ?? prod.sellingPrice ?? 0,
                  ),
                );
          matchedSum = matchedSum.plus(unitP.times(item.quantity));
        }
      }

      if (matchedQty === 0) {
        throw new BadRequestException(
          targetType === 'ARTICLE' || targetType === 'QUANTITY'
            ? `Ce code promo ne s’applique qu’à l’article ciblé (absent de votre panier).`
            : targetType === 'CATEGORY'
            ? `Aucun article de votre panier n’appartient au rayon ciblé par ce code promo.`
            : `Aucun article de votre panier ne correspond à la marque ciblée par ce code promo.`,
        );
      }

      if (targetType === 'QUANTITY' && coupon.minQuantity && matchedQty < coupon.minQuantity) {
        throw new BadRequestException(
          `Ce code promo requiert au moins ${coupon.minQuantity} exemplaire(s) de l’article ciblé dans votre panier.`,
        );
      }

      eligibleAmount = matchedSum.greaterThan(0) ? matchedSum : orderAmount;
    }

    if (targetType === 'CUSTOMER' && targetIds.length > 0) {
      const custEmail = dto.customerEmail?.toLowerCase().trim();
      if (!custEmail || !targetIds.some((t) => t.toLowerCase().trim() === custEmail)) {
        throw new BadRequestException(
          `Ce code promo privilège est nominatif et réservé à un autre compte client.`,
        );
      }
    }

    if (dto.customerId && coupon.perUserLimit) {
      const userUsageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          customerId: dto.customerId,
        },
      });

      if (userUsageCount >= coupon.perUserLimit) {
        throw new BadRequestException(`Vous avez déjà utilisé ce code promo le nombre maximum de fois autorisé.`);
      }
    }

    // Calculate discount on eligible amount
    let discountAmount = new Decimal(0);
    const couponVal = new Decimal(coupon.value);

    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = eligibleAmount.times(couponVal).dividedBy(100);
      if (coupon.maxDiscount && discountAmount.greaterThan(coupon.maxDiscount)) {
        discountAmount = new Decimal(coupon.maxDiscount);
      }
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discountAmount = Decimal.min(eligibleAmount, couponVal);
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      const feeSetting = await this.prisma.settings.findUnique({ where: { key: 'shipping.standard_fee' } });
      discountAmount = new Decimal(Number(feeSetting?.value ?? 7.0));
    }

    const netTotal = Decimal.max(0, orderAmount.minus(discountAmount));

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value.toNumber(),
        description: coupon.description,
      },
      discountAmount: discountAmount.toNumber(),
      netTotal: netTotal.toNumber(),
    };
  }
}
