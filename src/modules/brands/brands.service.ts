import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { generateSlug } from '@royal/shared-utils';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    return brands.map((b) => ({
      ...b,
      productsCount: b._count.products,
    }));
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException('Marque introuvable');
    }

    return brand;
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Marque avec le slug "${slug}" introuvable`);
    }

    return brand;
  }

  async create(createBrandDto: CreateBrandDto) {
    const slug = createBrandDto.slug
      ? generateSlug(createBrandDto.slug)
      : generateSlug(createBrandDto.name);

    const existing = await this.prisma.brand.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Une marque avec le slug "${slug}" existe déjà`);
    }

    return this.prisma.brand.create({
      data: {
        name: createBrandDto.name,
        slug,
        description: createBrandDto.description || null,
        logoUrl: createBrandDto.logoUrl || null,
        website: createBrandDto.website || null,
        isActive: createBrandDto.isActive ?? true,
      },
    });
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException('Marque introuvable');
    }

    let slug = brand.slug;
    if (updateBrandDto.slug && updateBrandDto.slug !== brand.slug) {
      slug = generateSlug(updateBrandDto.slug);
      const existing = await this.prisma.brand.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Le slug "${slug}" est déjà pris`);
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        name: updateBrandDto.name,
        slug,
        description: updateBrandDto.description,
        logoUrl: updateBrandDto.logoUrl,
        website: updateBrandDto.website,
        isActive: updateBrandDto.isActive,
      },
    });
  }

  async delete(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException('Marque introuvable');
    }

    if (brand._count.products > 0) {
      throw new ConflictException(
        `Impossible de supprimer : cette marque est associée à ${brand._count.products} produit(s).`,
      );
    }

    await this.prisma.brand.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Marque supprimée avec succès',
    };
  }
}
