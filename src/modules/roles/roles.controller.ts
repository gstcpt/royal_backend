import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Liste de tous les rôles avec compteurs' })
  @ApiResponse({ status: 200, description: 'Liste des rôles' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Détails d’un rôle avec ses permissions' })
  @ApiResponse({ status: 200, description: 'Rôle trouvé' })
  @ApiResponse({ status: 404, description: 'Rôle introuvable' })
  async findById(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @Permissions('roles.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’un rôle personnalisé' })
  @ApiResponse({ status: 201, description: 'Rôle créé avec succès' })
  @ApiResponse({ status: 403, description: 'Nom ROOT interdit' })
  @ApiResponse({ status: 409, description: 'Rôle déjà existant' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Put(':id')
  @Permissions('roles.update')
  @ApiOperation({ summary: 'Mise à jour d’un rôle' })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour' })
  @ApiResponse({ status: 403, description: 'Modification du rôle ROOT interdite' })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'Suppression d’un rôle personnalisé' })
  @ApiResponse({ status: 200, description: 'Rôle supprimé' })
  @ApiResponse({ status: 403, description: 'Rôles système protégés' })
  async delete(@Param('id') id: string) {
    return this.rolesService.delete(id);
  }

  @Post(':id/permissions')
  @Permissions('roles.permissions.assign')
  @ApiOperation({ summary: 'Affectation des permissions à un rôle' })
  @ApiResponse({ status: 200, description: 'Permissions affectées avec succès' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, assignPermissionsDto);
  }
}
