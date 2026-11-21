import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Warehouses & Entrepôts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @Permissions('inventory:view', 'warehouses:view')
  @ApiOperation({ summary: 'Lister tous les entrepôts et dépôts' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Liste des entrepôts retournée avec succès' })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.warehousesService.findAll(activeOnly === 'true');
  }

  @Get(':id')
  @Permissions('inventory:view', 'warehouses:view')
  @ApiOperation({ summary: 'Obtenir les détails d’un entrepôt avec ses stocks' })
  @ApiResponse({ status: 200, description: 'Détails de l’entrepôt retournés' })
  findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @Permissions('warehouses:create', 'inventory:manage')
  @ApiOperation({ summary: 'Créer un nouvel entrepôt' })
  @ApiResponse({ status: 201, description: 'Entrepôt créé avec succès' })
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Put(':id')
  @Permissions('warehouses:update', 'inventory:manage')
  @ApiOperation({ summary: 'Mettre à jour un entrepôt existant (complet)' })
  @ApiResponse({ status: 200, description: 'Entrepôt mis à jour' })
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Patch(':id')
  @Permissions('warehouses:update', 'inventory:manage')
  @ApiOperation({ summary: 'Mettre à jour un entrepôt (partiel / statut)' })
  @ApiResponse({ status: 200, description: 'Entrepôt mis à jour' })
  patch(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('warehouses:delete', 'inventory:manage')
  @ApiOperation({ summary: 'Supprimer ou désactiver un entrepôt' })
  @ApiResponse({ status: 200, description: 'Entrepôt supprimé ou désactivé' })
  remove(@Param('id') id: string) {
    return this.warehousesService.remove(id);
  }
}
