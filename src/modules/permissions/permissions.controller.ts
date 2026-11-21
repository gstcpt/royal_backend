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
