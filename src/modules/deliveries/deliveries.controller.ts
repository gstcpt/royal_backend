import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@royal/shared-types';
import { DeliveriesService } from './deliveries.service';
import {
  CalculateDeliveryQuoteDto,
  CheckShowroomsAvailabilityDto,
  UpsertDeliveryCompanyDto,
} from './dto/delivery-company.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Deliveries & Pricing Companies')
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Public()
  @Get('geography')
  @ApiOperation({ summary: 'Catalogue géographique Pays -> État/Gouvernorat pour Checkout et Livraison' })
  getGeography() {
    return this.deliveriesService.getGeographyCatalog();
  }

  @Public()
  @Post('calculate-quote')
  @ApiOperation({ summary: 'Calculer les tarifs de livraison (Distance Point A->B, Poids, Tarif Fixe)' })
  calculateQuote(@Body() dto: CalculateDeliveryQuoteDto) {
    return this.deliveriesService.calculateDeliveryQuotes(dto);
  }

  @Public()
  @Post('showrooms-availability')
  @ApiOperation({ summary: 'Vérifier la disponibilité stock par Showroom pour le retrait en magasin' })
  checkShowroomsAvailability(@Body() dto: CheckShowroomsAvailabilityDto) {
    return this.deliveriesService.checkShowroomsAvailability(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('settings')
  @Permissions('settings.read|deliveries.read')
  @ApiOperation({ summary: 'Lire la configuration système livraison, distances personnalisées et transferts' })
  getSettings() {
    return this.deliveriesService.getDeliverySettings();
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Put('settings')
  @Roles(SystemRole.ROOT, SystemRole.SUPER_ADMIN, SystemRole.WEBSITE_MANAGER)
  @Permissions('settings.update|deliveries.manage')
  @ApiOperation({ summary: 'Mettre à jour la configuration système livraison, distances et transferts' })
  updateSettings(@Body() body: any) {
    return this.deliveriesService.updateDeliverySettings(body || {});
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('companies')
  @Permissions('delivery_companies.read|deliveries.read')
  @ApiOperation({ summary: 'Lister les sociétés de livraison avec méthodes Distance / Poids / Fixe' })
  listCompanies(@Query('activeOnly') activeOnly?: string) {
    return this.deliveriesService.listCompanies(activeOnly === 'true');
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post('companies')
  @Permissions('delivery_companies.create|deliveries.create')
  @ApiOperation({ summary: 'Créer une société de livraison et ses grilles tarifaires' })
  createCompany(@Body() dto: UpsertDeliveryCompanyDto) {
    return this.deliveriesService.createCompany(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch('companies/:id')
  @Permissions('delivery_companies.update|deliveries.update')
  @ApiOperation({ summary: 'Modifier une société de livraison et ses méthodes Distance/Poids/Fixe' })
  updateCompany(@Param('id') id: string, @Body() dto: Partial<UpsertDeliveryCompanyDto>) {
    return this.deliveriesService.updateCompany(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch('companies/:id/toggle-active')
  @Permissions('delivery_companies.update|deliveries.update')
  @ApiOperation({ summary: 'Activer / désactiver une société de livraison pour le checkout' })
  toggleCompanyActive(@Param('id') id: string) {
    return this.deliveriesService.toggleCompanyActive(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Delete('companies/:id')
  @Permissions('delivery_companies.delete|deliveries.delete')
  @ApiOperation({ summary: 'Supprimer (ou désactiver si liée) une société de livraison' })
  deleteCompany(@Param('id') id: string) {
    return this.deliveriesService.deleteCompany(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('slips')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'Lister les expéditions SQL liées aux commandes et sociétés de livraison' })
  listSlips() {
    return this.deliveriesService.listDbDeliveries();
  }
}
