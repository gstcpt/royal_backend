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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CharacteristicsService } from './characteristics.service';
import {
  CreateCharacteristicDto,
  UpdateCharacteristicDto,
} from './dto/characteristic.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Characteristics')
@Controller('characteristics')
export class CharacteristicsController {
  constructor(private readonly characteristicsService: CharacteristicsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lister les caractéristiques techniques' })
  findAll(@Query('categoryId') categoryId?: string) {
    return this.characteristicsService.findAll(categoryId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’une caractéristique par ID' })
  findById(@Param('id') id: string) {
    return this.characteristicsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('characteristics.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle caractéristique technique' })
  create(@Body() dto: CreateCharacteristicDto) {
    return this.characteristicsService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('characteristics.update')
  @ApiOperation({ summary: 'Mettre à jour une caractéristique' })
  update(@Param('id') id: string, @Body() dto: UpdateCharacteristicDto) {
    return this.characteristicsService.update(id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('characteristics.update')
  @ApiOperation({ summary: 'Mettre à jour partiellement une caractéristique' })
  patch(@Param('id') id: string, @Body() dto: UpdateCharacteristicDto) {
    return this.characteristicsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('characteristics.delete')
  @ApiOperation({ summary: 'Supprimer une caractéristique' })
  delete(@Param('id') id: string) {
    return this.characteristicsService.delete(id);
  }
}
