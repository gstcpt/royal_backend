import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateSlug } from '@royal/shared-utils';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find categories: either flat list or hierarchical tree
   */
  async findAll(tree = false) {
    const activeProductWhere = { status: ProductStatus.ACTIVE, deletedAt: null };

    if (tree) {
      const topLevel = await this.prisma.category.findMany({
        where: { parentId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              children: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                include: {
                  _count: { select: { products: { where: activeProductWhere } } },
                },
              },
              _count: { select: { products: { where: activeProductWhere } } },
            },
          },
          _count: { select: { products: { where: activeProductWhere } } },
        },
      });

      const attachCounts = (node: any): any => {
        const mappedChildren = (node.children || []).map(attachCounts);
        const directCount = Number(node._count?.products || 0);
        const childSum = mappedChildren.reduce((sum: number, c: any) => sum + Number(c.productsCount || 0), 0);
        return {
          ...node,
          children: mappedChildren,
          directProductsCount: directCount,
          productsCount: directCount + childSum,
        };
      };

      return topLevel.map(attachCounts);
    }

    // Flat list (only active non-deleted products count toward storefront/catalog eligibility)
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            products: { where: activeProductWhere },
            children: true,
          },
        },
      },
    });

    const byParent = new Map<string | null, string[]>();
    const directMap = new Map<string, number>();
    for (const cat of categories) {
      directMap.set(cat.id, cat._count.products);
      const pid = cat.parentId ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(cat.id);
    }

    const computeSubtreeCount = (catId: string): number => {
      let total = directMap.get(catId) || 0;
      for (const childId of byParent.get(catId) || []) {
        total += computeSubtreeCount(childId);
      }
      return total;
    };

    return categories.map((cat) => ({
      ...cat,
      directProductsCount: cat._count.products,
      productsCount: computeSubtreeCount(cat.id),
      childrenCount: cat._count.children,
    }));
  }

  /**
   * Find single category by ID
   */
  async findById(id: string) {
    const activeProductWhere = { deletedAt: null };
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { products: { where: activeProductWhere } } } },
        },
        _count: { select: { products: { where: activeProductWhere } } },
      },
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    return category;
  }

  /**
   * Find category by unique slug
   */
  async findBySlug(slug: string) {
    const activeProductWhere = { deletedAt: null };
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: { where: activeProductWhere } } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Catégorie avec le slug "${slug}" introuvable`);
    }

    return category;
  }

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto) {
    const slug = createCategoryDto.slug
      ? generateSlug(createCategoryDto.slug)
      : generateSlug(createCategoryDto.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Une catégorie avec le slug "${slug}" existe déjà`);
    }

    if (createCategoryDto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: createCategoryDto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Catégorie parente introuvable');
      }
    }

    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        nameAr: createCategoryDto.nameAr || null,
        slug,
        description: createCategoryDto.description || null,
        descriptionAr: createCategoryDto.descriptionAr || null,
        imageUrl: createCategoryDto.imageUrl || null,
        parentId: createCategoryDto.parentId || null,
        sortOrder: createCategoryDto.sortOrder ?? 0,
        isActive: createCategoryDto.isActive ?? true,
        showinmenu: createCategoryDto.showinmenu ?? true,
        metaTitle: createCategoryDto.metaTitle || null,
        metaDesc: createCategoryDto.metaDesc || null,
        metaKeywords: createCategoryDto.metaKeywords || null,
      },
    });
  }

  /**
   * Update category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    let slug = category.slug;
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      slug = generateSlug(updateCategoryDto.slug);
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Le slug "${slug}" est déjà utilisé`);
      }
    }

    if (updateCategoryDto.parentId && updateCategoryDto.parentId === id) {
      throw new ConflictException('Une catégorie ne peut pas être son propre parent');
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
        nameAr: updateCategoryDto.nameAr,
        slug,
        description: updateCategoryDto.description,
        descriptionAr: updateCategoryDto.descriptionAr,
        imageUrl: updateCategoryDto.imageUrl,
        parentId: updateCategoryDto.parentId,
        sortOrder: updateCategoryDto.sortOrder,
        isActive: updateCategoryDto.isActive,
        showinmenu: updateCategoryDto.showinmenu,
        metaTitle: updateCategoryDto.metaTitle,
        metaDesc: updateCategoryDto.metaDesc,
        metaKeywords: updateCategoryDto.metaKeywords,
      },
    });
  }

  /**
   * Delete category
   */
  async delete(id: string) {
    return this.bulkDelete([id], true);
  }

  async bulkDelete(ids: string[], singleMode = false) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { success: true, deletedCount: 0, message: 'Aucune catégorie sélectionnée.' };
    }

    const targets = await this.prisma.category.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        _count: {
          select: {
            products: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (targets.length === 0) {
      throw new NotFoundException('Catégorie introuvable');
    }

    const blocking = targets.filter((c) => c._count.products > 0);
    if (blocking.length > 0) {
      if (singleMode && blocking.length === 1) {
        throw new ConflictException(
          `Impossible de supprimer : cette catégorie contient ${blocking[0]._count.products} produit(s).`,
        );
      }
      const details = blocking
        .map((c) => `"${c.name}" (${c._count.products} produit(s))`)
        .join(', ');
      throw new ConflictException(
        `Impossible de supprimer : des articles actifs existent dans ${details}.`,
      );
    }

    const targetIdSet = new Set(targets.map((t) => t.id));
    const allCategories = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const parentById = new Map(allCategories.map((c) => [c.id, c.parentId]));

    const getDepth = (catId: string): number => {
      let depth = 0;
      let curr: string | null | undefined = catId;
      const visited = new Set<string>();
      while (curr && !visited.has(curr)) {
        visited.add(curr);
        const p = parentById.get(curr);
        if (!p) break;
        depth += 1;
        curr = p;
      }
      return depth;
    };

    const getSurvivingAncestor = (catId: string): string | null => {
      let curr = parentById.get(catId) ?? null;
      const visited = new Set<string>([catId]);
      while (curr && targetIdSet.has(curr) && !visited.has(curr)) {
        visited.add(curr);
        curr = parentById.get(curr) ?? null;
      }
      return curr && !targetIdSet.has(curr) ? curr : null;
    };

    // Delete deepest child/grandchild categories before parents
    const orderedIds = Array.from(targetIdSet).sort((a, b) => getDepth(b) - getDepth(a));

    await this.prisma.$transaction(async (tx) => {
      const targetArray = Array.from(targetIdSet);

      // Reassign soft-deleted archive products to a surviving category so FK deletion never fails
      const softDeletedCount = await tx.product.count({
        where: { categoryId: { in: targetArray }, deletedAt: { not: null } },
      });
      if (softDeletedCount > 0) {
        const fallbackCategory = await tx.category.findFirst({
          where: { id: { notIn: targetArray } },
          select: { id: true },
        });
        if (!fallbackCategory) {
          throw new ConflictException(
            'Impossible de supprimer toutes les catégories tant que des produits archivés y sont rattachés.',
          );
        }
        await tx.product.updateMany({
          where: { categoryId: { in: targetArray }, deletedAt: { not: null } },
          data: { categoryId: fallbackCategory.id },
        });
      }

      for (const id of orderedIds) {
        const survivingParent = getSurvivingAncestor(id);
        await tx.category.updateMany({
          where: { parentId: id },
          data: { parentId: survivingParent },
        });
        await tx.category.delete({ where: { id } });
      }
    });

    return {
      success: true,
      deletedCount: orderedIds.length,
      message:
        orderedIds.length === 1
          ? 'Catégorie supprimée avec succès'
          : `${orderedIds.length} catégories supprimées avec succès`,
    };
  }
}
