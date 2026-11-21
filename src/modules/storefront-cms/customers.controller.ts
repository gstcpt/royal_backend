import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorefrontCmsService } from './storefront-cms.service';

@ApiTags('Clients CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: StorefrontCmsService) {}

  private ensureStaff(req: any) {
    const roles: string[] = Array.isArray(req?.user?.roles) ? req.user.roles : [];
    if (roles.length === 0 || (roles.length === 1 && roles[0] === 'CLIENT')) {
      throw new ForbiddenException('Accès réservé à l’équipe back-office.');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Lister les fiches clients PostgreSQL avec agrégats commandes' })
  findAll(@Req() req: any, @Query('limit') limit?: string, @Query('search') search?: string) {
    this.ensureStaff(req);
    return this.service.getCustomersList(limit ? Number(limit) : 200, search);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un client B2C ou B2B en base PostgreSQL' })
  create(@Req() req: any, @Body() body: any) {
    this.ensureStaff(req);
    return this.service.createCustomerRecord(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un client B2C ou B2B' })
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureStaff(req);
    return this.service.updateCustomerRecord(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiver une fiche client' })
  remove(@Req() req: any, @Param('id') id: string) {
    this.ensureStaff(req);
    return this.service.deleteCustomerRecord(id);
  }
}
