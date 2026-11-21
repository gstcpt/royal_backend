import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeOnly = false) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    return this.prisma.warehouse.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            stock: true,
            pos: true,
            transfersIn: true,
            transfersOut: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        pos: true,
        stock: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
          take: 50,
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException(`Entrepôt introuvable avec l’ID : ${id}`);
    }

    return warehouse;
  }

  async create(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Le code entrepôt ${dto.code} est déjà utilisé.`);
    }

    // If marked default, unset others
    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.create({
      data: dto,
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.warehouse.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Le code entrepôt ${dto.code} est déjà utilisé.`);
      }
    }

    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const warehouse = await this.findOne(id);

    // Check if there is physical stock
    const totalPhysical = await this.prisma.stock.aggregate({
      where: { warehouseId: id },
      _sum: { physicalQty: true },
    });

    if ((totalPhysical._sum.physicalQty || 0) > 0) {
      // Deactivate instead of hard delete
      return this.prisma.warehouse.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.warehouse.delete({
      where: { id },
    });
  }
}
