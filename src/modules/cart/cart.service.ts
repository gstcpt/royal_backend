import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(sessionId?: string, customerId?: string) {
    if (!sessionId && !customerId) {
      throw new BadRequestException('Un identifiant de session ou de client est requis pour le panier.');
    }

    const cartInclude = {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: { where: { isPrimary: true }, take: 1 },
                },
              },
              stock: true,
            },
          },
        },
      },
    };

    let customerCart = customerId
      ? await this.prisma.cart.findFirst({ where: { customerId }, include: cartInclude })
      : null;

    const sessionCart = sessionId
      ? await this.prisma.cart.findFirst({ where: { sessionId }, include: cartInclude })
      : null;

    // Merge guest session cart items into customer cart if user authenticated mid-session
    if (customerId && sessionCart && sessionCart.items.length > 0) {
      if (!customerCart) {
        customerCart = await this.prisma.cart.update({
          where: { id: sessionCart.id },
          data: { customerId },
          include: cartInclude,
        });
      } else if (customerCart.id !== sessionCart.id) {
        for (const sItem of sessionCart.items) {
          if (!sItem.variantId) continue;
          const existing = await this.prisma.cartItem.findUnique({
            where: {
              cartId_productId_variantId: {
                cartId: customerCart.id,
                productId: sItem.productId,
                variantId: sItem.variantId,
              },
            },
          });
          if (existing) {
            await this.prisma.cartItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + sItem.quantity },
            });
          } else {
            await this.prisma.cartItem.create({
              data: {
                cartId: customerCart.id,
                productId: sItem.productId,
                variantId: sItem.variantId,
                quantity: sItem.quantity,
              },
            });
          }
        }
        await this.prisma.cartItem.deleteMany({ where: { cartId: sessionCart.id } });
        customerCart = await this.prisma.cart.findFirst({ where: { id: customerCart.id }, include: cartInclude });
      }
    }

    let cart = customerCart || sessionCart;

    if (!cart) {
      await this.prisma.cart.create({
        data: {
          sessionId,
          customerId,
          currency: 'TND',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        },
      });

      cart = await this.prisma.cart.findFirst({
        where: customerId ? { customerId } : { sessionId },
        include: cartInclude,
      });
    }

    return cart!;
  }

  async getCart(sessionId?: string, customerId?: string) {
    const cart = await this.getOrCreateCart(sessionId, customerId);

    let subtotal = new Decimal(0);
    const items = cart.items || [];
    const formattedItems = items.map((item) => {
      const variant = item.variant;
      const product = variant?.product;

      // Determine price (sellingPrice on variant or product)
      const priceVal = variant?.sellingPrice ?? product?.discountPrice ?? product?.sellingPrice ?? product?.basePrice ?? new Decimal(0);
      const unitPrice = priceVal.toNumber();
      const lineTotal = new Decimal(unitPrice).times(item.quantity).toNumber();
      subtotal = subtotal.plus(lineTotal);

      // Determine total available physical stock across warehouses
      const physicalTotal = variant?.stock?.reduce((acc, s) => acc + s.physicalQty, 0) ?? 0;
      const reservedTotal = variant?.stock?.reduce((acc, s) => acc + s.reservedQty, 0) ?? 0;
      const availableQty = Math.max(0, physicalTotal - reservedTotal);

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: product?.name || 'Produit',
        variantName: variant?.name || null,
        sku: variant?.sku || '',
        barcode: variant?.barcode || null,
        image: product?.images?.[0]?.url || null,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        availableQty,
        isAvailable: availableQty >= item.quantity,
      };
    });

    const subtotalNum = subtotal.toNumber();
    const shipSettings = await this.prisma.settings.findMany({
      where: { key: { in: ['shipping.free_threshold', 'shipping.standard_fee'] } },
    });
    const shipMap = new Map(shipSettings.map((s) => [s.key, Number(s.value)]));
    const shippingThreshold = shipMap.get('shipping.free_threshold') ?? 150.0;
    const standardShipping = shipMap.get('shipping.standard_fee') ?? 7.0;
    const shippingAmount = subtotalNum >= shippingThreshold || subtotalNum === 0 ? 0 : standardShipping;
    const taxAmount = Number((subtotalNum * 0.19).toFixed(3)); // 19% TVA standard
    const totalAmount = Number((subtotalNum + shippingAmount).toFixed(3));

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      customerId: cart.customerId,
      currency: cart.currency,
      itemsCount: items.reduce((sum, it) => sum + it.quantity, 0),
      items: formattedItems,
      subtotal: subtotalNum,
      shippingAmount,
      taxAmount,
      totalAmount,
      isFreeShippingEligible: subtotalNum >= shippingThreshold,
      freeShippingThreshold: shippingThreshold,
    };
  }

  private async ensureCartId(sessionId?: string, customerId?: string): Promise<string> {
    if (!sessionId && !customerId) {
      throw new BadRequestException('Un identifiant de session ou de client est requis pour le panier.');
    }

    if (customerId) {
      const existing = await this.prisma.cart.findFirst({
        where: { customerId },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    if (sessionId) {
      const sessionCart = await this.prisma.cart.findFirst({
        where: { sessionId },
        select: { id: true, customerId: true },
      });
      if (sessionCart) {
        if (customerId && !sessionCart.customerId) {
          await this.prisma.cart.update({
            where: { id: sessionCart.id },
            data: { customerId },
          });
        }
        return sessionCart.id;
      }
    }

    const created = await this.prisma.cart.create({
      data: {
        sessionId,
        customerId,
        currency: 'TND',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    return created.id;
  }

  async addItem(dto: AddToCartDto, sessionId?: string, customerId?: string) {
    const cartId = await this.ensureCartId(sessionId, customerId);

    // Verify product & variant
    let variantId = dto.variantId;
    let productId = dto.productId;

    if (variantId && !productId) {
      const v = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true, productId: true } });
      if (v) {
        productId = v.productId;
      } else {
        const firstVariant = await this.prisma.productVariant.findFirst({
          where: { productId: variantId, isActive: true },
          select: { id: true, productId: true },
        });
        if (!firstVariant) {
          throw new NotFoundException('Variante de produit introuvable.');
        }
        productId = firstVariant.productId;
        variantId = firstVariant.id;
      }
    } else if (!variantId && productId) {
      const firstVariant = await this.prisma.productVariant.findFirst({
        where: { productId, isActive: true },
        select: { id: true },
      });
      if (!firstVariant) {
        throw new NotFoundException('Aucune variante disponible pour ce produit.');
      }
      variantId = firstVariant.id;
    }

    if (!productId || !variantId) {
      throw new BadRequestException('Produit ou variante non spécifié.');
    }

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId_variantId: {
          cartId,
          productId,
          variantId,
        },
      },
      select: { id: true, quantity: true },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId,
          productId,
          variantId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(sessionId, customerId);
  }

  async updateItem(itemId: string, dto: UpdateCartItemDto, sessionId?: string, customerId?: string) {
    const cart = await this.getOrCreateCart(sessionId, customerId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('Article de panier introuvable.');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(sessionId, customerId);
  }

  async removeItem(itemId: string, sessionId?: string, customerId?: string) {
    const cart = await this.getOrCreateCart(sessionId, customerId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (item && item.cartId === cart.id) {
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
    }

    return this.getCart(sessionId, customerId);
  }

  async clearCart(sessionId?: string, customerId?: string) {
    const cartId = await this.ensureCartId(sessionId, customerId);
    await this.prisma.cartItem.deleteMany({
      where: { cartId },
    });

    return this.getCart(sessionId, customerId);
  }

  async validateCart(sessionId?: string, customerId?: string) {
    const cart = await this.getCart(sessionId, customerId);
    const unavailableItems = cart.items.filter((it) => !it.isAvailable);

    return {
      isValid: unavailableItems.length === 0 && cart.items.length > 0,
      hasOutOfStock: unavailableItems.length > 0,
      unavailableItems,
      cart,
    };
  }
}
