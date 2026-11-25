import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Liste exhaustive des permissions groupées par module' })
  @ApiResponse({ status: 200, description: 'Permissions groupées' })
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get('views')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Liste des correspondances permissions_views ordonnées 1..13' })
  @ApiResponse({ status: 200, description: 'Table permissions_views' })
  async listViews() {
    return this.permissionsService.listPermissionViews();
  }

  @Post('scan-sync-views')
  @Permissions('roles.permissions.assign')
  @ApiOperation({ summary: 'Scanner routes frontend + controllers backend et synchroniser permissions_views' })
  async scanAndSyncViews() {
    return this.permissionsService.scanAndSyncViews();
  }

  @Post('assign-delivery-defaults')
  @Permissions('roles.permissions.assign')
  @ApiOperation({ summary: 'Attribuer les permissions et vues par défaut à DELIVERY_MANAGER et DELIVERY_AGENT' })
  async assignDeliveryDefaults(@Body() body?: { force?: boolean }) {
    return this.permissionsService.assignDeliveryDefaults(Boolean(body?.force));
  }

  @Get('module/:name')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Liste des permissions pour un module spécifique' })
  @ApiResponse({ status: 200, description: 'Permissions du module' })
  async findByModule(@Param('name') name: string) {
    return this.permissionsService.findByModule(name);
  }

  @Post()
  @Permissions('roles.permissions.assign')
  @ApiOperation({ summary: 'Créer dynamiquement une nouvelle permission CRUD en base' })
  async create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Delete(':id')
  @Permissions('roles.permissions.assign')
  @ApiOperation({ summary: 'Supprimer une permission personnalisée en base' })
  async delete(@Param('id') id: string) {
    return this.permissionsService.delete(id);
  }
}
