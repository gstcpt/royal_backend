import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.read')
  @ApiOperation({ summary: 'Liste paginée des utilisateurs avec filtres' })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs récupérée' })
  async findMany(@Query() query: QueryUsersDto) {
    return this.usersService.findMany(query);
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOperation({ summary: 'Détails d’un utilisateur par identifiant' })
  @ApiResponse({ status: 200, description: 'Utilisateur trouvé' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Permissions('users.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’un nouvel utilisateur' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 403, description: 'Interdiction d’assigner le rôle ROOT' })
  @ApiResponse({ status: 409, description: 'Adresse email déjà utilisée' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.create(createUserDto, currentUserId);
  }

  @Put(':id')
  @Permissions('users.update')
  @ApiOperation({ summary: 'Mise à jour des informations d’un utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur mis à jour' })
  @ApiResponse({ status: 403, description: 'Modification non autorisée (ex: compte ROOT)' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.update(id, updateUserDto, currentUserId);
  }

  @Delete(':id')
  @Permissions('users.delete')
  @ApiOperation({ summary: 'Suppression (soft-delete) d’un utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé' })
  @ApiResponse({ status: 403, description: 'Protection ROOT : suppression interdite' })
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Patch(':id/status')
  @Permissions('users.update')
  @ApiOperation({ summary: 'Activation / Désactivation du compte utilisateur' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.usersService.toggleStatus(id, isActive);
  }

  @Post(':id/reset-password')
  @Permissions('users.update')
  @ApiOperation({ summary: 'Régénérer un mot de passe sécurisé et l’envoyer par e-mail SMTP à l’utilisateur' })
  @ApiResponse({ status: 201, description: 'Nouveau mot de passe généré et envoyé par e-mail' })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.resetPassword(id, currentUserId);
  }
}
