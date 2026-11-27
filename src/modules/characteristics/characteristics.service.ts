import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCharacteristicDto,
  UpdateCharacteristicDto,
} from './dto/characteristic.dto';
import { normalizeSystemCode } from '../../common/utils/security.util';

@Injectable()
export class CharacteristicsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(input: string): string {
    return normalizeSystemCode(input);
  }

  private format(item: any) {
    const options = Array.isArray(item.optionsJson) ? item.optionsJson : [];
    const categoryIds = Array.isArray(item.categories)
      ? item.categories.map((c: any) => c.categoryId)
      : [];

    return {
      id: item.id,
      name: item.name,
      nameAr: item.nameAr,
      code: item.code,
      description: item.description,
      type: item.type,
      unit: item.unit,
      isRequired: item.isRequired,
      isFilterable: item.isFilterable,
      iconUrl: item.iconUrl,
      options,
      optionsJson: item.optionsJson,
      categoryIds,
      articlesCount: item.articlesCount ?? 0,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      updatedBy: item.updatedBy,
      isUpdated: item.isUpdated,
      isDeleted: item.isDeleted,
    };
  }

  async findAll(categoryId?: string) {
    const where: any = {
      deletedAt: null,
    };

    if (categoryId) {
      where.OR = [
        { categories: { some: { categoryId } } },
        { categories: { none: {} } },
      ];
    }

    const [items, products] = await Promise.all([
      this.prisma.characteristic.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          categories: {
            select: { categoryId: true, sortOrder: true },
          },
        },
      }),
      this.prisma.product.findMany({
        where: { deletedAt: null },
        select: { dimensionsJson: true },
      }),
    ]);

    const codeCounts: Record<string, number> = {};
    for (const p of products) {
      if (p.dimensionsJson && typeof p.dimensionsJson === 'object' && !Array.isArray(p.dimensionsJson)) {
        for (const [k, v] of Object.entries(p.dimensionsJson as Record<string, any>)) {
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            codeCounts[k] = (codeCounts[k] || 0) + 1;
          }
        }
      }
    }

    return items.map((item) =>
      this.format({
        ...item,
        articlesCount: codeCounts[item.code] || 0,
      }),
    );
  }

  async findById(id: string) {
    const item = await this.prisma.characteristic.findFirst({
      where: { id, deletedAt: null },
      include: {
        categories: { select: { categoryId: true, sortOrder: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Caractéristique introuvable');
    }

    return this.format(item);
  }

  async create(dto: CreateCharacteristicDto) {
    const code = this.normalizeCode(dto.code || dto.name);
    const existing = await this.prisma.characteristic.findUnique({
      where: { code },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Une caractéristique avec le code "${code}" existe déjà`);
    }

    const optionsVal =
      dto.options && dto.options.length > 0
        ? dto.options
        : Array.isArray(dto.optionsJson)
          ? dto.optionsJson
          : null;

    const validCategoryIds =
      dto.categoryIds && dto.categoryIds.length > 0
        ? (
            await this.prisma.category.findMany({
              where: { id: { in: dto.categoryIds } },
              select: { id: true },
            })
          ).map((c) => c.id)
        : [];

    const created = await this.prisma.characteristic.create({
      data: {
        name: dto.name.trim(),
        nameAr: dto.nameAr?.trim() || null,
        code: existing ? `${code}_${Date.now()}` : code,
        description: dto.description?.trim() || null,
        type: dto.type || 'TEXT',
        unit: dto.unit?.trim() || null,
        isRequired: dto.isRequired ?? false,
        isFilterable: dto.isFilterable ?? true,
        iconUrl: dto.iconUrl?.trim() || null,
        optionsJson: optionsVal ?? undefined,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        ...(validCategoryIds.length > 0
          ? {
              categories: {
                create: validCategoryIds.map((catId, idx) => ({
                  categoryId: catId,
                  sortOrder: idx,
                })),
              },
            }
          : {}),
      },
      include: {
        categories: { select: { categoryId: true, sortOrder: true } },
      },
    });

    return this.format(created);
  }

  async update(id: string, dto: UpdateCharacteristicDto) {
    const existing = await this.prisma.characteristic.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Caractéristique introuvable');
    }

    let nextCode = existing.code;
    if (dto.code && this.normalizeCode(dto.code) !== existing.code) {
      nextCode = this.normalizeCode(dto.code);
      const conflict = await this.prisma.characteristic.findUnique({
        where: { code: nextCode },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Le code "${nextCode}" est déjà utilisé`);
      }
    }

    const optionsVal =
      dto.options !== undefined
        ? dto.options
        : dto.optionsJson !== undefined
          ? dto.optionsJson
          : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.categoryIds !== undefined) {
        await tx.categoryCharacteristic.deleteMany({
          where: { characteristicId: id },
        });
        if (dto.categoryIds.length > 0) {
          const validCats = await tx.category.findMany({
            where: { id: { in: dto.categoryIds } },
            select: { id: true },
          });
          if (validCats.length > 0) {
            await tx.categoryCharacteristic.createMany({
              data: validCats.map((c, idx) => ({
                categoryId: c.id,
                characteristicId: id,
                sortOrder: idx,
              })),
            });
          }
        }
      }

      return tx.characteristic.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          nameAr: dto.nameAr !== undefined ? dto.nameAr.trim() || null : undefined,
          code: nextCode,
          description:
            dto.description !== undefined ? dto.description.trim() || null : undefined,
          type: dto.type,
          unit: dto.unit !== undefined ? dto.unit.trim() || null : undefined,
          isRequired: dto.isRequired,
          isFilterable: dto.isFilterable,
          iconUrl: dto.iconUrl !== undefined ? dto.iconUrl.trim() || null : undefined,
          optionsJson: optionsVal !== undefined ? optionsVal : undefined,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
          isUpdated: true,
        },
        include: {
          categories: { select: { categoryId: true, sortOrder: true } },
        },
      });
    });

    return this.format(updated);
  }

  async delete(id: string) {
    const existing = await this.prisma.characteristic.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Caractéristique introuvable');
    }

    await this.prisma.characteristic.delete({ where: { id } });

    return {
      success: true,
      message: `La caractéristique "${existing.name}" a été supprimée.`,
    };
  }
}
