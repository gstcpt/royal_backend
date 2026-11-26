import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StockTransfersService } from './stock-transfers.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StockTransferStatus } from '@prisma/client';
import { SystemRole } from '@royal/shared-types';

@ApiTags('Stock Transfers (Inter-Dépôts)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('transfers')
export class StockTransfersController {
  constructor(private readonly transfersService: StockTransfersService) {}

  @Get()
  @Permissions('transfers:view', 'inventory:view')
  @ApiOperation({ summary: 'Lister les transferts inter-entrepôts' })
  @ApiQuery({ name: 'status', enum: StockTransferStatus, required: false })
  @ApiResponse({ status: 200, description: 'Liste des transferts' })
  findAll(@Query('status') status?: StockTransferStatus) {
    return this.transfersService.findAll(status);
  }

  @Get(':id')
  @Permissions('transfers:view', 'inventory:view')
  @ApiOperation({ summary: 'Consulter un transfert détaillé avec ses lignes' })
  @ApiResponse({ status: 200, description: 'Détails du transfert' })
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Post()
  @Permissions('transfers:create', 'inventory:manage')
  @ApiOperation({ summary: 'Initier une demande de transfert inter-dépôts' })
  @ApiResponse({ status: 201, description: 'Transfert créé au statut PENDING' })
  create(@Body() dto: CreateStockTransferDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.transfersService.create(dto, userId);
  }

  @Post(':id/accept')
  @Roles(SystemRole.ROOT, SystemRole.SUPER_ADMIN, SystemRole.WEBSITE_MANAGER)
  @Permissions('transfers:approve', 'inventory:manage')
  @ApiOperation({ summary: 'Accepter une demande de transfert (Exécution immédiate OUT+IN ou Suivi par étapes)' })
  @ApiResponse({ status: 200, description: 'Demande acceptée et bon de transfert TRF généré' })
  accept(
    @Param('id') id: string,
    @Body() body: { mode?: 'IMMEDIATE' | 'STEP_BY_STEP' },
    @Req() req: any,
  ) {
    const userId = req.user?.email || req.user?.id || 'system';
    return this.transfersService.accept(id, userId, body?.mode || 'STEP_BY_STEP');
  }

  @Post(':id/approve')
  @Roles(SystemRole.ROOT, SystemRole.SUPER_ADMIN, SystemRole.WEBSITE_MANAGER)
  @Permissions('transfers:approve', 'inventory:manage')
  @ApiOperation({ summary: 'Approuver une demande de transfert (mode par étapes)' })
  @ApiResponse({ status: 200, description: 'Transfert approuvé' })
  approve(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.email || req.user?.id || 'system';
    return this.transfersService.approve(id, userId);
  }

  @Post(':id/dispatch')
  @Permissions('transfers:dispatch', 'inventory:manage')
  @ApiOperation({ summary: 'Expédier le transfert (décrémente le stock d’origine et passe en transit)' })
  @ApiResponse({ status: 200, description: 'Transfert expédié' })
  dispatch(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.email || req.user?.id || 'system';
    return this.transfersService.dispatch(id, userId);
  }

  @Post(':id/receive')
  @Permissions('transfers:receive', 'inventory:manage')
  @ApiOperation({ summary: 'Réceptionner le transfert (incrémente le stock de destination et clôture)' })
  @ApiResponse({ status: 200, description: 'Transfert réceptionné' })
  receive(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.email || req.user?.id || 'system';
    return this.transfersService.receive(id, userId);
  }

  @Post(':id/cancel')
  @Permissions('transfers:cancel', 'inventory:manage')
  @ApiOperation({ summary: 'Annuler un transfert' })
  @ApiResponse({ status: 200, description: 'Transfert annulé' })
  cancel(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.transfersService.cancel(id, userId);
  }
}
