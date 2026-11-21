import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste de toutes les marques partenaires' })
  @ApiResponse({ status: 200, description: 'Marques récupérées' })
  async findAll() {
    return this.brandsService.findAll();
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Détails d’une marque par son slug' })
  @ApiResponse({ status: 200, description: 'Marque trouvée' })
  @ApiResponse({ status: 404, description: 'Marque introuvable' })
  async findBySlug(@Param('slug') slug: string) {
    return this.brandsService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’une marque par ID' })
  @ApiResponse({ status: 200, description: 'Marque trouvée' })
  async findById(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('brands.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Création d’une marque' })
  @ApiResponse({ status: 201, description: 'Marque créée' })
  async create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('brands.update')
  @ApiOperation({ summary: 'Mise à jour complète d’une marque' })
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('brands.update')
  @ApiOperation({ summary: 'Mise à jour partielle ou visibilité d’une marque' })
  async patch(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('brands.delete')
  @ApiOperation({ summary: 'Suppression d’une marque' })
  async delete(@Param('id') id: string) {
    return this.brandsService.delete(id);
  }
}
