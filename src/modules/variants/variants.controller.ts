import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VariantsService } from './variants.service';
import {
  CreateVariantFamilyDto,
  UpdateVariantFamilyDto,
} from './dto/variant.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Variants')
@Controller('variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lister toutes les familles de variantes et leurs options' })
  findAll() {
    return this.variantsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’une famille de variantes par ID' })
  findById(@Param('id') id: string) {
    return this.variantsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('variants.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle famille de variantes' })
  create(@Body() dto: CreateVariantFamilyDto) {
    return this.variantsService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('variants.update')
  @ApiOperation({ summary: 'Mettre à jour une famille de variantes' })
  update(@Param('id') id: string, @Body() dto: UpdateVariantFamilyDto) {
    return this.variantsService.update(id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('variants.update')
  @ApiOperation({ summary: 'Mettre à jour partiellement une famille de variantes' })
  patch(@Param('id') id: string, @Body() dto: UpdateVariantFamilyDto) {
    return this.variantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('variants.delete')
  @ApiOperation({ summary: 'Supprimer une famille de variantes' })
  delete(@Param('id') id: string) {
    return this.variantsService.delete(id);
  }
}
