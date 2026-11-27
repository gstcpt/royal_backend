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
import { PosService } from './pos.service';
import { CreatePointOfSaleDto } from './dto/create-pos.dto';
import { CreateCashRegisterDto } from './dto/create-register.dto';
import { OpenSessionDto, CloseSessionDto, CashMovementDto } from './dto/session-actions.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Point of Sale (POS) & Caisses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get()
  @Permissions('pos:view')
  @ApiOperation({ summary: 'Lister tous les points de vente et boutiques' })
  @ApiResponse({ status: 200, description: 'Points de vente listés' })
  findAllPos() {
    return this.posService.findAllPos();
  }

  @Post()
  @Permissions('pos:manage')
  @ApiOperation({ summary: 'Créer un nouveau point de vente associé à un entrepôt' })
  @ApiResponse({ status: 201, description: 'Point de vente créé' })
  createPos(@Body() dto: CreatePointOfSaleDto) {
    return this.posService.createPos(dto);
  }

  @Get('registers')
  @Permissions('pos:view')
  @ApiOperation({ summary: 'Lister les caisses enregistreuses et l’état de leurs sessions' })
  @ApiQuery({ name: 'posId', required: false })
  @ApiResponse({ status: 200, description: 'Caisses enregistreuses listées' })
  findAllRegisters(@Query('posId') posId?: string) {
    return this.posService.findAllRegisters(posId);
  }

  @Post('registers')
  @Permissions('pos:manage')
  @ApiOperation({ summary: 'Créer une caisse enregistreuse' })
  @ApiResponse({ status: 201, description: 'Caisse créée avec succès' })
  createRegister(@Body() dto: CreateCashRegisterDto) {
    return this.posService.createRegister(dto);
  }

  @Get('registers/:id/session')
  @Permissions('pos:operate|pos:view')
  @ApiOperation({ summary: 'Consulter la session active d’une caisse' })
  @ApiResponse({ status: 200, description: 'Détails de la session active' })
  getCurrentSession(@Param('id') registerId: string) {
    return this.posService.getCurrentSession(registerId);
  }

  @Post('registers/:id/session/open')
  @Permissions('pos:operate')
  @ApiOperation({ summary: 'Ouvrir une nouvelle session de caisse avec fond initial' })
  @ApiResponse({ status: 201, description: 'Session de caisse ouverte' })
  openSession(
    @Param('id') registerId: string,
    @Body() dto: OpenSessionDto,
    @Req() req: any,
  ) {
    const cashierId = req.user?.id || 'cashier';
    return this.posService.openSession(registerId, dto, cashierId);
  }

  @Post('sessions/:id/close')
  @Permissions('pos:operate')
  @ApiOperation({ summary: 'Clôturer la session de caisse avec comptage réel et calcul d’écart' })
  @ApiResponse({ status: 200, description: 'Session clôturée avec succès' })
  closeSession(
    @Param('id') sessionId: string,
    @Body() dto: CloseSessionDto,
    @Req() req: any,
  ) {
    const cashierId = req.user?.id || 'cashier';
    return this.posService.closeSession(sessionId, dto, cashierId);
  }

  @Post('sessions/:id/movements')
  @Permissions('pos:operate')
  @ApiOperation({ summary: 'Consigner un mouvement de caisse (prélèvement, rajout, dépense)' })
  @ApiResponse({ status: 201, description: 'Mouvement consigné' })
  addMovement(@Param('id') sessionId: string, @Body() dto: CashMovementDto) {
    return this.posService.addMovement(sessionId, dto);
  }

  @Post('checkout')
  @Permissions('pos:operate')
  @ApiOperation({ summary: 'Exécuter un encaissement vente POS avec déstockage atomique et ticket' })
  @ApiResponse({ status: 200, description: 'Vente validée et reçu thermique généré' })
  checkout(@Body() dto: PosCheckoutDto, @Req() req: any) {
    const cashierId = req.user?.id || 'cashier';
    return this.posService.checkout(dto, cashierId);
  }
}
