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
  Req,
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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { StorefrontQueryDto } from './dto/storefront-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ProductStatus } from '@royal/shared-types';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('storefront')
  @ApiOperation({ summary: 'Catalogue public avec recherche instantanée et filtres à facettes' })
  @ApiResponse({ status: 200, description: 'Articles récupérés' })
  async findStorefront(@Query() query: StorefrontQueryDto) {
    return this.productsService.findStorefront(query);
  }

  @Public()
  @Get('storefront-facets')
  @ApiOperation({ summary: 'Facettes dynamiques (variantes & caractéristiques réelles) pour filtres catalogue' })
  @ApiResponse({ status: 200, description: 'Facettes récupérées' })
  async getStorefrontFacets() {
    return this.productsService.getStorefrontFacets();
  }

  @Public()
  @Get('compare')
  @ApiOperation({ summary: 'Comparateur de produits côte à côte (Décision D7 : max 4)' })
  @ApiQuery({ name: 'ids', type: String, description: 'IDs séparés par virgules (ex: id1,id2,id3)' })
  @ApiResponse({ status: 200, description: 'Tableau comparatif généré' })
  async compareProducts(@Query('ids') idsString: string) {
    const ids = idsString ? idsString.split(',').map((id) => id.trim()) : [];
    return this.productsService.compareProducts(ids);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Fiche produit détaillée par slug' })
  @ApiResponse({ status: 200, description: 'Fiche produit trouvée' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’un produit par ID' })
  @ApiResponse({ status: 200, description: 'Produit trouvé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async findById(@Param('id') id: string, @Req() req?: any) {
    return this.productsService.findById(id, req?.user);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.read')
  @ApiOperation({ summary: 'Gestion des articles du catalogue (Back-Office)' })
  @ApiResponse({ status: 200, description: 'Articles paginés' })
  async findMany(@Query() query: QueryProductsDto) {
    return this.productsService.findMany(query);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’un nouvel article avec variantes' })
  @ApiResponse({ status: 201, description: 'Article créé avec succès' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.update')
  @ApiOperation({ summary: 'Mise à jour complète d’un article' })
  @ApiResponse({ status: 200, description: 'Article mis à jour' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.update')
  @ApiOperation({ summary: 'Mise à jour partielle ou visibilité d’un article' })
  @ApiResponse({ status: 200, description: 'Article mis à jour' })
  async patch(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.delete')
  @ApiOperation({ summary: 'Suppression (soft-delete) d’un article' })
  @ApiResponse({ status: 200, description: 'Article supprimé' })
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products.update')
  @ApiOperation({ summary: 'Basculement du statut de publication' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('status') status?: ProductStatus,
  ) {
    return this.productsService.toggleStatus(id, status);
  }
}
