import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Commandes (Orders)')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Passer une nouvelle commande (Client ou Invité)' })
  @ApiResponse({ status: 201, description: 'Commande validée avec snapshot immuable et référence' })
  createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.ordersService.create(dto, userId);
  }

  @Public()
  @Get('track')
  @ApiOperation({ summary: 'Suivi de commande pour client invité (Référence + Contact)' })
  trackGuestOrder(
    @Query('reference') reference: string,
    @Query('contact') contact: string,
  ) {
    return this.ordersService.trackGuestOrder(reference, contact);
  }

  @Get('my-orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Historique des commandes du client connecté' })
  getMyOrders(@Req() req: any, @Query() query: QueryOrdersDto) {
    const userId = req.user.id;
    return this.ordersService.findMyOrders(userId, query);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('orders:read')
  @ApiOperation({ summary: 'Lister les commandes avec filtres et recherche (Back-Office)' })
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails complets d’une commande avec historique des statuts' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Faire évoluer le statut d’une commande (Workflow)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: any,
  ) {
    const changedBy = req.user?.email || req.user?.id || 'admin';
    return this.ordersService.updateStatus(id, dto.status, changedBy, dto.comment);
  }

  @Post('bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Mise à jour de statut ou archivage groupé de commandes' })
  bulkAction(
    @Body() body: { ids: string[]; action: 'STATUS' | 'DELETE'; status?: any; comment?: string },
    @Req() req: any,
  ) {
    const changedBy = req.user?.email || req.user?.id || 'admin';
    return this.ordersService.bulkAction(body.ids || [], body.action, body.status, changedBy, body.comment);
  }
}
