import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Suppliers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Permissions('suppliers.read')
  @ApiOperation({ summary: 'Liste de tous les fournisseurs' })
  @ApiResponse({ status: 200, description: 'Fournisseurs récupérés' })
  async findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @Permissions('suppliers.read')
  @ApiOperation({ summary: 'Détails d’un fournisseur par ID' })
  @ApiResponse({ status: 200, description: 'Fournisseur trouvé' })
  async findById(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  @Permissions('suppliers.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’un fournisseur' })
  @ApiResponse({ status: 201, description: 'Fournisseur créé' })
  async create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Put(':id')
  @Permissions('suppliers.update')
  @ApiOperation({ summary: 'Mise à jour d’un fournisseur (complète)' })
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Patch(':id')
  @Permissions('suppliers.update')
  @ApiOperation({ summary: 'Mise à jour partielle ou statut d’un fournisseur' })
  async patch(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Permissions('suppliers.delete')
  @ApiOperation({ summary: 'Suppression d’un fournisseur' })
  async delete(@Param('id') id: string) {
    return this.suppliersService.delete(id);
  }
}
