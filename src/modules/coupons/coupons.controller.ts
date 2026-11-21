import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/create-coupon.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Coupons & Promotions')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Public()
  @Post('validate')
  @ApiOperation({ summary: 'Valider un code promo (Public / Client / Invité)' })
  @ApiResponse({ status: 200, description: 'Statut de validité et calcul de la réduction' })
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Codes promos actifs publics (Vitrine / Espace Client)' })
  findPublicActive() {
    return this.couponsService.findAll({ isActive: true, page: 1, limit: 20 });
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:read')
  @ApiOperation({ summary: 'Lister les codes promos (Back-Office)' })
  findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.couponsService.findAll({ search, isActive, page, limit });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:read')
  @ApiOperation({ summary: 'Détails d’un code promo avec historique des utilisations' })
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:create')
  @ApiOperation({ summary: 'Créer un nouveau coupon de réduction' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:update')
  @ApiOperation({ summary: 'Modifier un code promo existant' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:delete')
  @ApiOperation({ summary: 'Supprimer un code promo' })
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
