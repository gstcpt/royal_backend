import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { StorefrontQueryDto } from './dto/storefront-query.dto';
import { generateSlug, toDecimal } from '@royal/shared-utils';
import { ProductStatus } from '@royal/shared-types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admin paginated list of products with filters
   */
  async findMany(query: QueryProductsDto) {
    const { page = 1, limit = 20, search, categoryId, brandId, supplierId, status, isFeatured } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (categoryId) {
      where.category = {
        OR: [
          { id: categoryId },
          { parentId: categoryId },
          { parent: { parentId: categoryId } },
          { parent: { parent: { parentId: categoryId } } },
        ],
      };
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true, code: true } },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            select: { id: true, url: true, alt: true, isPrimary: true, sortOrder: true },
          },
          variants: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sku: true,
              name: true,
              sellingPrice: true,
              attributesJson: true,
              stock: { select: { warehouseId: true, physicalQty: true, reservedQty: true } },
            },
          },
          _count: {
            select: {
              variants: true,
              reviews: true,
            },
          },
        },
      }),
    ]);

    const formatted = products.map((p) => {
      const totalStock = p.variants.reduce(
        (acc, v) =>
          acc +
          (v.stock || []).reduce(
            (sAcc, s) => sAcc + Math.max(0, s.physicalQty - s.reservedQty),
            0,
          ),
        0,
      );
      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        basePrice: Number(p.basePrice),
        sellingPrice: Number(p.sellingPrice),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        taxRate: Number(p.taxRate),
        status: p.status,
        isFeatured: p.isFeatured,
        isComparable: p.isComparable,
        dimensionsJson: p.dimensionsJson,
        metaTitle: p.metaTitle,
        metaDesc: p.metaDesc,
        metaKeywords: p.metaKeywords,
        category: p.category,
        brand: p.brand,
        supplier: p.supplier,
        images: p.images,
        primaryImage: p.images[0]?.url || '/images/products/placeholder.jpg',
        variants: p.variants.map((v) => ({
          ...v,
          sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : Number(p.sellingPrice),
        })),
        availableStock: totalStock,
        variantsCount: p._count.variants,
        reviewsCount: p._count.reviews,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isUpdated: p.isUpdated,
        isDeleted: p.isDeleted,
      };
    });

    return {
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Public Storefront product browsing, faceted filtering and collection querying
   */
  async findStorefront(query: StorefrontQueryDto) {
    const {
      page = 1,
      limit = 12,
      search,
      categorySlug,
      category,
      brandSlug,
      brand,
      minPrice,
      maxPrice,
      sort = 'newest',
      sortBy,
      collection = 'all',
    } = query;

    const activeCatSlugs = (category || categorySlug || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const activeBrandSlugs = (brand || brandSlug || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const activeVariantOpts = (query.variantOptions || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let parsedChars: Record<string, string[]> = {};
    if (query.chars) {
      try {
        const raw = JSON.parse(query.chars);
        if (raw && typeof raw === 'object') {
          parsedChars = raw;
        }
      } catch {
        // ignore invalid json
      }
    }
    const activeSort = sortBy || sort || 'newest';

    const skip = (page - 1) * limit;

    const where: any = {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
    };
    const andFilters: any[] = [];

    if (activeCatSlugs.length > 0) {
      andFilters.push({
        OR: activeCatSlugs.map((slugOrId) => ({
          category: {
            OR: [
              { slug: slugOrId },
              { id: slugOrId },
              { parent: { slug: slugOrId } },
              { parent: { id: slugOrId } },
              { parent: { parent: { slug: slugOrId } } },
              { parent: { parent: { id: slugOrId } } },
              { parent: { parent: { parent: { slug: slugOrId } } } },
            ],
          },
        })),
      });
    }

    if (activeBrandSlugs.length > 0) {
      where.brand = { slug: { in: activeBrandSlugs } };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = minPrice;
      if (maxPrice !== undefined) where.sellingPrice.lte = maxPrice;
    }

    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { shortDescription: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (collection === 'featured') {
      where.isFeatured = true;
    } else if (collection === 'promo') {
      where.discountPrice = { not: null };
    }

    if (query.inStock) {
      andFilters.push({
        variants: {
          some: {
            stock: {
              some: {
                physicalQty: { gt: 0 },
              },
            },
          },
        },
      });
    }

    if (activeVariantOpts.length > 0) {
      andFilters.push({
        variants: {
          some: {
            OR: activeVariantOpts.map((opt) => ({
              name: { contains: opt, mode: 'insensitive' },
            })),
          },
        },
      });
    }

    for (const [charKey, charValues] of Object.entries(parsedChars)) {
      if (Array.isArray(charValues) && charValues.length > 0) {
        andFilters.push({
          OR: charValues.map((val) => ({
            dimensionsJson: {
              path: [charKey],
              string_contains: val,
            },
          })),
        });
      }
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    // Determine sorting criteria
    let orderBy: any = { createdAt: 'desc' };
    if (activeSort === 'price_asc') {
      orderBy = { sellingPrice: 'asc' };
    } else if (activeSort === 'price_desc') {
      orderBy = { sellingPrice: 'desc' };
    } else if (activeSort === 'popular') {
      orderBy = { viewCount: 'desc' };
    } else if (activeSort === 'featured') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    } else if (activeSort === 'promo') {
      orderBy = [{ discountPrice: 'asc' }, { createdAt: 'desc' }];
    }

    if (activeSort === 'bestsellers') {
      const topSales = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
      });
      if (topSales.length > 0) {
        where.id = { in: topSales.map((s) => s.productId) };
      }
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            select: { url: true, alt: true, isPrimary: true },
          },
          variants: {
            select: {
              id: true,
              sku: true,
              name: true,
              sellingPrice: true,
              attributesJson: true,
              stock: { select: { warehouseId: true, physicalQty: true, reservedQty: true } },
            },
          },
          _count: {
            select: { reviews: true },
          },
        },
      }),
    ]);

    const formatted = products.map((p) => {
      const primaryImage =
        p.images.find((img) => img.isPrimary)?.url ||
        p.images[0]?.url ||
        '/images/products/placeholder.jpg';
      const gallery = p.images.map((img) => img.url);

      const discountPercent =
        p.discountPrice && Number(p.discountPrice) < Number(p.sellingPrice)
          ? Math.round(
              ((Number(p.sellingPrice) - Number(p.discountPrice)) /
                Number(p.sellingPrice)) *
                100,
            )
          : null;

      const availableStock = p.variants.reduce(
        (acc, v) =>
          acc +
          (v.stock || []).reduce(
            (sAcc, s) => sAcc + Math.max(0, s.physicalQty - s.reservedQty),
            0,
          ),
        0,
      );

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        sellingPrice: Number(p.sellingPrice),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        discountPercent,
        discountPercentage: discountPercent,
        isFeatured: p.isFeatured,
        isNewArrival: true,
        rating: 4.9,
        dimensionsJson: p.dimensionsJson,
        primaryImage,
        images: gallery.length > 0 ? gallery : [primaryImage],
        category: p.category,
        brand: p.brand,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : Number(p.sellingPrice),
          attributesJson: v.attributesJson,
        })),
        availableStock,
        stockStatus: availableStock > 0 || p.variants.length > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        variantsCount: p.variants.length,
        reviewsCount: p._count.reviews,
        reviewCount: p._count.reviews,
        viewCount: p.viewCount,
        likeCount: p.likeCount ?? 0,
        dislikeCount: (p as any).dislikeCount ?? 0,
        favoriteCount: p.favoriteCount ?? 0,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isUpdated: p.isUpdated,
        isDeleted: p.isDeleted,
      };
    });

    return {
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Compute dynamic variants & characteristics filter facets from active storefront products
   */
  async getStorefrontFacets() {
    const [variantFamilies, activeCharDefs, products] = await Promise.all([
      this.prisma.variantFamily.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          options: true,
        },
      }),
      this.prisma.characteristic.findMany({
        where: { isActive: true, isFilterable: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE, deletedAt: null },
        select: {
          dimensionsJson: true,
          variants: {
            where: { isActive: true },
            select: { name: true, attributesJson: true },
          },
        },
      }),
    ]);

    // Extract actual used variant option values paired cleanly with family options
    const usedVariantNames = new Set<string>();
    for (const p of products) {
      for (const v of p.variants || []) {
        if (v.name) usedVariantNames.add(v.name.toLowerCase());
        if (v.attributesJson && typeof v.attributesJson === 'object') {
          for (const val of Object.values(v.attributesJson as Record<string, any>)) {
            if (val) usedVariantNames.add(String(val).toLowerCase());
          }
        }
      }
    }

    const variantFacets = variantFamilies
      .map((vf) => {
        const opts = Array.isArray(vf.options) ? (vf.options as any[]) : [];
        const activeOpts = opts
          .filter((o) => {
            const label = typeof o === 'string' ? o : o?.label || o?.value || o?.name;
            if (!label) return false;
            const low = String(label).toLowerCase();
            for (const used of usedVariantNames) {
              if (used.includes(low)) return true;
            }
            return false;
          })
          .map((o) => ({
            label: typeof o === 'string' ? o : o?.label || o?.value || o?.name,
            value: typeof o === 'string' ? o : o?.label || o?.value || o?.name,
            colorHex: typeof o === 'object' ? o?.colorHex || o?.hex || null : null,
          }));
        return {
          id: vf.id,
          name: vf.name,
          code: vf.code,
          options: activeOpts.slice(0, 18),
        };
      })
      .filter((vf) => vf.options.length > 0);

    // Aggregate top used characteristic values from dimensionsJson
    const valueCounts: Record<string, Map<string, number>> = {};
    for (const p of products) {
      const dims = p.dimensionsJson as Record<string, any> | null;
      if (!dims || typeof dims !== 'object') continue;
      for (const [key, val] of Object.entries(dims)) {
        if (['stockQuantity', 'lowStockThreshold', 'allowBackorders'].includes(key)) continue;
        if (val === null || val === undefined) continue;
        const cleanVal = String(val).trim();
        if (!cleanVal || cleanVal.length > 60) continue;
        if (!valueCounts[key]) valueCounts[key] = new Map<string, number>();
        valueCounts[key].set(cleanVal, (valueCounts[key].get(cleanVal) || 0) + 1);
      }
    }

    const characteristicFacets = activeCharDefs
      .map((ch) => {
        const countsMap = valueCounts[ch.code];
        if (!countsMap) return null;
        const options = Array.from(countsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([value, count]) => ({ value, count }));
        if (options.length === 0) return null;
        return {
          id: ch.id,
          code: ch.code,
          name: ch.name,
          options,
        };
      })
      .filter(Boolean);

    return {
      variantFamilies: variantFacets,
      characteristics: characteristicFacets,
    };
  }

  /**
   * Side-by-side Product Comparison (Decision D7: Up to 4 products)
   */
  async compareProducts(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun identifiant de produit fourni');
    }

    if (ids.length > 4) {
      throw new BadRequestException('La comparaison est limitée à 4 produits simultanément');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: ids },
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: { url: true, alt: true },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            name: true,
            sellingPrice: true,
            attributesJson: true,
            stock: {
              select: {
                physicalQty: true,
                reservedQty: true,
              },
            },
          },
        },
      },
    });

    // Track analytics comparison counter asynchronously
    this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { compareCount: { increment: 1 } },
    }).catch(() => null);

    const formatted = products.map((p) => {
      const primaryImage =
        p.images[0]?.url || '/images/products/placeholder.jpg';

      const totalStock = p.variants.reduce((acc, v) => {
        const variantStock = v.stock.reduce(
          (sAcc, s) => sAcc + Math.max(0, Number(s.physicalQty || 0) - Number(s.reservedQty || 0)),
          0,
        );
        return acc + variantStock;
      }, 0);

      // Extract unique variant attributes
      const attributesAggregated: Record<string, string[]> = {};
      for (const v of p.variants) {
        if (v.attributesJson && typeof v.attributesJson === 'object') {
          for (const [key, val] of Object.entries(v.attributesJson)) {
            if (!attributesAggregated[key]) {
              attributesAggregated[key] = [];
            }
            if (!attributesAggregated[key].includes(String(val))) {
              attributesAggregated[key].push(String(val));
            }
          }
        }
      }

      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        sellingPrice: Number(p.sellingPrice),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        taxRate: Number(p.taxRate),
        weight: p.weight ? Number(p.weight) : null,
        dimensions: p.dimensionsJson || null,
        category: p.category?.name || 'Général',
        brand: p.brand?.name || 'Royal Signature',
        primaryImage,
        inStock: totalStock > 0 || p.variants.length === 0,
        totalStock,
        attributes: attributesAggregated,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.sellingPrice ? Number(v.sellingPrice) : Number(p.sellingPrice),
        })),
      };
    });

    return formatted;
  }

  /**
   * Find single product by slug (public storefront detail)
   */
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true, logoUrl: true, description: true } },
        supplier: { select: { id: true, name: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: { id: true, url: true, alt: true, isPrimary: true },
        },
        variants: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            sku: true,
            barcode: true,
            name: true,
            nameAr: true,
            attributesJson: true,
            sellingPrice: true,
            imageUrl: true,
            stock: {
              select: {
                physicalQty: true,
                reservedQty: true,
                warehouse: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec le slug "${slug}" introuvable`);
    }

    // Increment view count asynchronously
    this.prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => null);

    return {
      ...product,
      basePrice: Number(product.basePrice),
      sellingPrice: Number(product.sellingPrice),
      discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
      taxRate: Number(product.taxRate),
      weight: product.weight ? Number(product.weight) : null,
    };
  }

  /**
   * Find product by ID (admin detail)
   */
  async findById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        brand: true,
        supplier: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: {
          orderBy: { sortOrder: 'asc' },
          include: {
            stock: {
              include: { warehouse: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    return {
      ...product,
      basePrice: Number(product.basePrice),
      sellingPrice: Number(product.sellingPrice),
      discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
      taxRate: Number(product.taxRate),
      weight: product.weight ? Number(product.weight) : null,
    };
  }

  /**
   * Create a new product with default variant and images
   */
  async create(createProductDto: CreateProductDto) {
    const sku = createProductDto.sku.toUpperCase();

    const existingSku = await this.prisma.product.findUnique({
      where: { sku },
    });
    if (existingSku) {
      throw new ConflictException(`Le SKU "${sku}" est déjà utilisé`);
    }

    const slug = createProductDto.slug
      ? generateSlug(createProductDto.slug)
      : generateSlug(createProductDto.name);

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Le slug "${slug}" existe déjà`);
    }

    const newProduct = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku,
          barcode: createProductDto.barcode || null,
          name: createProductDto.name,
          nameAr: createProductDto.nameAr || null,
          slug,
          shortDescription: createProductDto.shortDescription || null,
          description: createProductDto.description || null,
          categoryId: createProductDto.categoryId,
          brandId: createProductDto.brandId || null,
          supplierId: createProductDto.supplierId || null,
          basePrice: toDecimal(createProductDto.basePrice),
          sellingPrice: toDecimal(createProductDto.sellingPrice),
          discountPrice: createProductDto.discountPrice
            ? toDecimal(createProductDto.discountPrice)
            : null,
          taxRate: toDecimal(createProductDto.taxRate ?? 0.19),
          weight: createProductDto.weight ? toDecimal(createProductDto.weight) : null,
          dimensionsJson: createProductDto.dimensionsJson || null,
          status: createProductDto.status ?? ProductStatus.ACTIVE,
          isFeatured: createProductDto.isFeatured ?? false,
          isComparable: createProductDto.isComparable ?? true,
          metaTitle: createProductDto.metaTitle || null,
          metaDesc: createProductDto.metaDesc || null,
          metaKeywords: createProductDto.metaKeywords || null,
          publishedAt:
            (createProductDto.status ?? ProductStatus.ACTIVE) === ProductStatus.ACTIVE ? new Date() : null,
        },
      });

      const defaultWh =
        (await tx.warehouse.findFirst({ where: { isDefault: true, isActive: true } })) ||
        (await tx.warehouse.findFirst({ where: { isActive: true } }));
      const initStockQty = Number(
        createProductDto.initialStock ??
          (createProductDto.dimensionsJson as any)?.stockQuantity ??
          20,
      );
      const lowThreshold = Number(
        (createProductDto.dimensionsJson as any)?.lowStockThreshold ?? 5,
      );

      // Create variants & initial stock
      if (createProductDto.variants && createProductDto.variants.length > 0) {
        for (let i = 0; i < createProductDto.variants.length; i++) {
          const v = createProductDto.variants[i];
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: v.sku.toUpperCase(),
              barcode: v.barcode || null,
              name: v.name,
              nameAr: v.nameAr || null,
              attributesJson: v.attributesJson,
              sellingPrice: v.sellingPrice ? toDecimal(v.sellingPrice) : null,
              purchasePrice: v.purchasePrice ? toDecimal(v.purchasePrice) : null,
              imageUrl: v.imageUrl || null,
              sortOrder: i,
            },
          });
          if (defaultWh) {
            await tx.stock.create({
              data: {
                variantId: createdVariant.id,
                warehouseId: defaultWh.id,
                physicalQty: initStockQty >= 0 ? initStockQty : 0,
                reservedQty: 0,
                reorderPoint: lowThreshold >= 0 ? lowThreshold : 5,
              },
            });
          }
        }
      } else {
        // Create default standard variant
        const stdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: `${sku}-STD`,
            name: `${createProductDto.name} - Standard`,
            attributesJson: { option: 'Standard' },
            sellingPrice: toDecimal(createProductDto.sellingPrice),
            sortOrder: 0,
          },
        });
        if (defaultWh) {
          await tx.stock.create({
            data: {
              variantId: stdVariant.id,
              warehouseId: defaultWh.id,
              physicalQty: initStockQty >= 0 ? initStockQty : 0,
              reservedQty: 0,
              reorderPoint: lowThreshold >= 0 ? lowThreshold : 5,
            },
          });
        }
      }

      // Create images
      if (createProductDto.images && createProductDto.images.length > 0) {
        for (let i = 0; i < createProductDto.images.length; i++) {
          const img = createProductDto.images[i];
          await tx.productImage.create({
            data: {
              productId: product.id,
              url: img.url,
              alt: img.alt || createProductDto.name,
              isPrimary: img.isPrimary !== undefined ? img.isPrimary : i === 0,
              sortOrder: img.sortOrder ?? i,
            },
          });
        }
      }

      return product;
    });

    if (newProduct.status === ProductStatus.ACTIVE) {
      this.notifyClientsOfCatalogEvent(
        `Nouvel article Royal : ${newProduct.name}`,
        `Découvrez notre nouveauté ${newProduct.name} au tarif de ${Number(newProduct.sellingPrice).toFixed(3)} TND.`,
        `/articles/${newProduct.slug}`,
        'CATALOG',
      ).catch(() => null);
    }

    return this.findById(newProduct.id);
  }

  private async notifyClientsOfCatalogEvent(
    title: string,
    body: string,
    link: string,
    channel: 'CATALOG' | 'PROMO' | 'PRICE',
  ) {
    const clients = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        userRoles: { some: { role: { name: 'CLIENT' } } },
      },
      select: { id: true },
    });
    if (clients.length === 0) return;
    await this.prisma.notification.createMany({
      data: clients.map((c) => ({
        userId: c.id,
        type: 'SYSTEM' as any,
        title,
        body,
        link,
        metadata: {
          channel,
          severity: 'INFO',
          targetRoles: 'CLIENT',
        } as any,
      })),
    });
  }

  /**
   * Update product
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    let slug = product.slug;
    if (updateProductDto.slug && updateProductDto.slug !== product.slug) {
      slug = generateSlug(updateProductDto.slug);
      const existing = await this.prisma.product.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Le slug "${slug}" est déjà pris`);
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: updateProductDto.name,
        nameAr: updateProductDto.nameAr,
        slug,
        shortDescription: updateProductDto.shortDescription,
        description: updateProductDto.description,
        categoryId: updateProductDto.categoryId,
        brandId: updateProductDto.brandId,
        supplierId: updateProductDto.supplierId,
        basePrice: updateProductDto.basePrice
          ? toDecimal(updateProductDto.basePrice)
          : undefined,
        sellingPrice: updateProductDto.sellingPrice
          ? toDecimal(updateProductDto.sellingPrice)
          : undefined,
        discountPrice:
          updateProductDto.discountPrice !== undefined
            ? updateProductDto.discountPrice
              ? toDecimal(updateProductDto.discountPrice)
              : null
            : undefined,
        taxRate: updateProductDto.taxRate
          ? toDecimal(updateProductDto.taxRate)
          : undefined,
        weight: updateProductDto.weight
          ? toDecimal(updateProductDto.weight)
          : undefined,
        dimensionsJson: updateProductDto.dimensionsJson,
        metaTitle: updateProductDto.metaTitle,
        metaDesc: updateProductDto.metaDesc,
        metaKeywords: updateProductDto.metaKeywords,
        status: updateProductDto.status,
        publishedAt:
          updateProductDto.status === ProductStatus.ACTIVE && !product.publishedAt
            ? new Date()
            : undefined,
        isFeatured: updateProductDto.isFeatured,
        isComparable: updateProductDto.isComparable,
        isUpdated: true,
      },
    });

    const oldSell = Number(product.sellingPrice);
    const newSell = Number(updated.sellingPrice);
    const oldDisc = product.discountPrice ? Number(product.discountPrice) : null;
    const newDisc = updated.discountPrice ? Number(updated.discountPrice) : null;

    if (updated.status === ProductStatus.ACTIVE) {
      if (newDisc !== null && newDisc !== oldDisc && newDisc < newSell) {
        this.notifyClientsOfCatalogEvent(
          `Promotion ajoutée : ${updated.name}`,
          `Profitez du nouveau prix promo ${newDisc.toFixed(3)} TND au lieu de ${newSell.toFixed(3)} TND.`,
          `/articles/${updated.slug}`,
          'PROMO',
        ).catch(() => null);
      } else if (newSell !== oldSell) {
        this.notifyClientsOfCatalogEvent(
          `Changement de prix : ${updated.name}`,
          `Le tarif de cet article est passé de ${oldSell.toFixed(3)} TND à ${newSell.toFixed(3)} TND.`,
          `/articles/${updated.slug}`,
          'PRICE',
        ).catch(() => null);
      }
    }

    if (updateProductDto.images && updateProductDto.images.length > 0) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      for (let i = 0; i < updateProductDto.images.length; i++) {
        const img = updateProductDto.images[i];
        await this.prisma.productImage.create({
          data: {
            productId: id,
            url: img.url,
            alt: img.alt || updateProductDto.name || product.name,
            isPrimary: img.isPrimary !== undefined ? img.isPrimary : i === 0,
            sortOrder: img.sortOrder ?? i,
          },
        });
      }
    }

    return this.findById(id);
  }

  /**
   * Soft-delete product
   */
  async delete(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ProductStatus.DISCONTINUED,
      },
    });

    return {
      success: true,
      message: 'Article supprimé du catalogue avec succès',
    };
  }

  /**
   * Toggle product active status
   */
  async toggleStatus(id: string, status?: ProductStatus) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const nextStatus =
      status ||
      (product.status === ProductStatus.ACTIVE
        ? ProductStatus.INACTIVE
        : ProductStatus.ACTIVE);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: nextStatus },
    });

    return {
      id: updated.id,
      status: updated.status,
      message: `Statut de l’article mis à jour: ${updated.status}`,
    };
  }
}
