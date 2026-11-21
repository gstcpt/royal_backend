import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    return suppliers.map((s) => ({
      ...s,
      productsCount: s._count.products,
    }));
  }

  async findById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable');
    }

    return supplier;
  }

  async create(createSupplierDto: CreateSupplierDto) {
    const code = createSupplierDto.code.toUpperCase();
    const existing = await this.prisma.supplier.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Un fournisseur avec le code "${code}" existe déjà`);
    }

    return this.prisma.supplier.create({
      data: {
        name: createSupplierDto.name,
        code,
        email: createSupplierDto.email || null,
        phone: createSupplierDto.phone || null,
        address: createSupplierDto.address || null,
        city: createSupplierDto.city || null,
        country: createSupplierDto.country || 'TN',
        taxId: createSupplierDto.taxId || null,
        supplierType: createSupplierDto.supplierType || 'COMPANY',
        cin: createSupplierDto.cin || null,
        contactPerson: createSupplierDto.contactPerson || null,
        paymentTerms: createSupplierDto.paymentTerms ?? null,
        leadTimeDays: createSupplierDto.leadTimeDays ?? 7,
        isActive: createSupplierDto.isActive ?? true,
      },
    });
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable');
    }

    if (updateSupplierDto.code && updateSupplierDto.code !== supplier.code) {
      const code = updateSupplierDto.code.toUpperCase();
      const existing = await this.prisma.supplier.findUnique({
        where: { code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Le code "${code}" est déjà utilisé`);
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: updateSupplierDto.name,
        code: updateSupplierDto.code ? updateSupplierDto.code.toUpperCase() : undefined,
        email: updateSupplierDto.email,
        phone: updateSupplierDto.phone,
        address: updateSupplierDto.address,
        city: updateSupplierDto.city,
        country: updateSupplierDto.country,
        taxId: updateSupplierDto.taxId,
        supplierType: updateSupplierDto.supplierType,
        cin: updateSupplierDto.cin,
        contactPerson: updateSupplierDto.contactPerson,
        paymentTerms: updateSupplierDto.paymentTerms,
        leadTimeDays: updateSupplierDto.leadTimeDays,
        isActive: updateSupplierDto.isActive,
      },
    });
  }

  async delete(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable');
    }

    if (supplier._count.products > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ce fournisseur est rattaché à ${supplier._count.products} article(s).`,
      );
    }

    await this.prisma.supplier.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Fournisseur supprimé avec succès',
    };
  }
}
