import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste des catégories (vue arborescente ou plate)' })
  @ApiQuery({ name: 'tree', required: false, type: Boolean, description: 'Afficher en arborescence parent/enfants' })
  @ApiResponse({ status: 200, description: 'Catégories récupérées' })
  async findAll(@Query('tree') tree?: string) {
    const isTree = tree === 'true' || tree === '1';
    return this.categoriesService.findAll(isTree);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Détails d’une catégorie par son slug' })
  @ApiResponse({ status: 200, description: 'Catégorie trouvée' })
  @ApiResponse({ status: 404, description: 'Catégorie introuvable' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’une catégorie par identifiant' })
  @ApiResponse({ status: 200, description: 'Catégorie trouvée' })
  @ApiResponse({ status: 404, description: 'Catégorie introuvable' })
  async findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('categories.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’une nouvelle catégorie' })
  @ApiResponse({ status: 201, description: 'Catégorie créée' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('categories.update')
  @ApiOperation({ summary: 'Mise à jour complète d’une catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('categories.update')
  @ApiOperation({ summary: 'Mise à jour partielle ou visibilité d’une catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour' })
  async patch(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('categories.delete')
  @ApiOperation({ summary: 'Suppression d’une catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée' })
  async delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }
}
