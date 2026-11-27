import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateVariantFamilyDto,
  UpdateVariantFamilyDto,
} from './dto/variant.dto';
import { normalizeSystemCode } from '../../common/utils/security.util';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(input: string): string {
    return normalizeSystemCode(input);
  }

  private format(family: any) {
    const values = (family.options || []).map((opt: any) => ({
      id: opt.id,
      label: opt.label,
      labelAr: opt.labelAr || undefined,
      code: opt.code || undefined,
      colorHex: opt.colorHex || undefined,
      sortOrder: opt.sortOrder,
      isActive: opt.isActive,
    }));

    return {
      id: family.id,
      name: family.name,
      nameAr: family.nameAr,
      code: family.code,
      description: family.description,
      visualType: family.visualType,
      sortOrder: family.sortOrder,
      isActive: family.isActive,
      articlesCount: family.articlesCount ?? 0,
      values,
      options: values,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      createdBy: family.createdBy,
      updatedBy: family.updatedBy,
      isUpdated: family.isUpdated,
      isDeleted: family.isDeleted,
    };
  }

  async findAll() {
    const [families, variants] = await Promise.all([
      this.prisma.variantFamily.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          options: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      this.prisma.productVariant.findMany({
        where: { product: { deletedAt: null } },
        select: { productId: true, attributesJson: true },
      }),
    ]);

    return families.map((f) => {
      const prodIds = new Set<string>();
      for (const v of variants) {
        const attrs = v.attributesJson as Record<string, any> | null;
        if (!attrs || typeof attrs !== 'object') continue;
        const val =
          attrs[f.code] ??
          (f.code === 'couleur' ? attrs.color : undefined) ??
          (f.code === 'capacite' ? attrs.size : undefined);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          prodIds.add(v.productId);
        }
      }
      return this.format({
        ...f,
        articlesCount: prodIds.size,
      });
    });
  }

  async findById(id: string) {
    const family = await this.prisma.variantFamily.findFirst({
      where: { id, deletedAt: null },
      include: {
        options: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!family) {
      throw new NotFoundException('Famille de variantes introuvable');
    }

    return this.format(family);
  }

  async create(dto: CreateVariantFamilyDto) {
    const code = this.normalizeCode(dto.code || dto.name);
    const existing = await this.prisma.variantFamily.findUnique({
      where: { code },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Une famille avec le code "${code}" existe déjà`);
    }

    const inputValues = dto.values || dto.options || [];

    const created = await this.prisma.variantFamily.create({
      data: {
        name: dto.name.trim(),
        nameAr: dto.nameAr?.trim() || null,
        code: existing ? `${code}_${Date.now()}` : code,
        description: dto.description?.trim() || null,
        visualType: dto.visualType || 'TEXT_PILL',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        options: {
          create: inputValues.map((val, idx) => ({
            label: val.label.trim(),
            labelAr: val.labelAr?.trim() || null,
            code: val.code?.trim() || this.normalizeCode(val.label),
            colorHex: val.colorHex?.trim() || null,
            sortOrder: val.sortOrder ?? idx,
            isActive: val.isActive ?? true,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return this.format(created);
  }

  async update(id: string, dto: UpdateVariantFamilyDto) {
    const existing = await this.prisma.variantFamily.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Famille de variantes introuvable');
    }

    let nextCode = existing.code;
    if (dto.code && this.normalizeCode(dto.code) !== existing.code) {
      nextCode = this.normalizeCode(dto.code);
      const conflict = await this.prisma.variantFamily.findUnique({
        where: { code: nextCode },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Le code "${nextCode}" est déjà utilisé`);
      }
    }

    const inputValues = dto.values !== undefined ? dto.values : dto.options;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (inputValues !== undefined) {
        await tx.variantOption.deleteMany({
          where: { variantFamilyId: id },
        });
        if (inputValues.length > 0) {
          await tx.variantOption.createMany({
            data: inputValues.map((val, idx) => ({
              variantFamilyId: id,
              label: val.label.trim(),
              labelAr: val.labelAr?.trim() || null,
              code: val.code?.trim() || this.normalizeCode(val.label),
              colorHex: val.colorHex?.trim() || null,
              sortOrder: val.sortOrder ?? idx,
              isActive: val.isActive ?? true,
            })),
          });
        }
      }

      return tx.variantFamily.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          nameAr: dto.nameAr !== undefined ? dto.nameAr.trim() || null : undefined,
          code: nextCode,
          description:
            dto.description !== undefined ? dto.description.trim() || null : undefined,
          visualType: dto.visualType,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
          isUpdated: true,
        },
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    return this.format(updated);
  }

  async delete(id: string) {
    const existing = await this.prisma.variantFamily.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Famille de variantes introuvable');
    }

    await this.prisma.variantFamily.delete({ where: { id } });

    return {
      success: true,
      message: `La famille de variantes "${existing.name}" a été supprimée.`,
    };
  }
}
