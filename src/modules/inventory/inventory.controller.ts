import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Inventory & Stocks Multi-Dépôts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Consulter l’état des stocks multi-entrepôts avec filtres' })
  @ApiResponse({ status: 200, description: 'Liste des stocks retournée' })
  findAll(@Query() query: QueryStockDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('alerts')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Consulter les alertes de stock bas ou rupture imminente' })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiResponse({ status: 200, description: 'Alertes de stock retournées' })
  getLowStockAlerts(@Query('warehouseId') warehouseId?: string) {
    return this.inventoryService.getLowStockAlerts(warehouseId);
  }

  @Get('movements')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Consulter le registre immuable des mouvements de stocks' })
  @ApiQuery({ name: 'stockId', required: false })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Historique des mouvements retourné' })
  findMovements(
    @Query('stockId') stockId?: string,
    @Query('variantId') variantId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.findMovements({
      stockId,
      variantId,
      warehouseId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Post('adjust')
  @Permissions('inventory:adjust')
  @ApiOperation({ summary: 'Ajuster manuellement un stock physique (inventaire)' })
  @ApiResponse({ status: 200, description: 'Stock physique ajusté et mouvement consigné' })
  adjustStock(@Body() dto: AdjustStockDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.inventoryService.adjustStock(dto, userId);
  }

  @Post('reserve')
  @Permissions('inventory:reserve')
  @ApiOperation({ summary: 'Réserver du stock pour une commande' })
  @ApiResponse({ status: 200, description: 'Stock réservé avec succès' })
  reserveStock(@Body() dto: ReserveStockDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.inventoryService.reserveStock(dto, userId);
  }

  @Post('release')
  @Permissions('inventory:reserve')
  @ApiOperation({ summary: 'Libérer du stock précédemment réservé' })
  @ApiResponse({ status: 200, description: 'Réservation libérée' })
  releaseStock(@Body() dto: ReserveStockDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.inventoryService.releaseStock(dto, userId);
  }
}
