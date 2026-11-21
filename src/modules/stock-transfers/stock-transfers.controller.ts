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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StockTransferStatus } from '@prisma/client';

@ApiTags('Stock Transfers (Inter-Dépôts)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Post(':id/approve')
  @Permissions('transfers:approve', 'inventory:manage')
  @ApiOperation({ summary: 'Approuver une demande de transfert' })
  @ApiResponse({ status: 200, description: 'Transfert approuvé' })
  approve(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.transfersService.approve(id, userId);
  }

  @Post(':id/dispatch')
  @Permissions('transfers:dispatch', 'inventory:manage')
  @ApiOperation({ summary: 'Expédier le transfert (décrémente le stock d’origine et passe en transit)' })
  @ApiResponse({ status: 200, description: 'Transfert expédié' })
  dispatch(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.transfersService.dispatch(id, userId);
  }

  @Post(':id/receive')
  @Permissions('transfers:receive', 'inventory:manage')
  @ApiOperation({ summary: 'Réceptionner le transfert (incrémente le stock de destination et clôture)' })
  @ApiResponse({ status: 200, description: 'Transfert réceptionné' })
  receive(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
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
