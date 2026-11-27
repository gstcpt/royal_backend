import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRole } from '@royal/shared-types';

@ApiTags('Audit Logs (ROOT ONLY)')
@ApiBearerAuth('JWT-auth')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ROOT)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques et KPIs d’audit réservés exclusivement au ROOT' })
  @ApiResponse({ status: 200, description: 'Métriques globales retournées' })
  @ApiResponse({ status: 403, description: 'Accès interdit hors rôle ROOT' })
  async getStats(@CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Accès strictement réservé au compte ROOT');
    }
    return this.auditLogsService.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'Liste filtrée et paginée des logs d’audit (ROOT ONLY)' })
  @ApiResponse({ status: 200, description: 'Historique des logs retourné' })
  @ApiResponse({ status: 403, description: 'Accès interdit hors rôle ROOT' })
  async findAll(@Query() query: QueryAuditLogsDto, @CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Accès strictement réservé au compte ROOT');
    }
    return this.auditLogsService.findMany(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail complet d’un événement d’audit avec diff JSON (ROOT ONLY)' })
  @ApiResponse({ status: 200, description: 'Détail de l’audit trouvé' })
  @ApiResponse({ status: 403, description: 'Accès interdit hors rôle ROOT' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Accès strictement réservé au compte ROOT');
    }
    return this.auditLogsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrement programmatique d’un événement d’audit (ROOT ONLY)' })
  async recordLog(@Body() dto: CreateAuditLogDto, @CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Enregistrement direct d’audit strictement réservé au compte ROOT');
    }
    return this.auditLogsService.recordLog(dto);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Suppression multiple de logs d’audit (ROOT EXCLUSIF)' })
  @ApiResponse({ status: 200, description: 'Logs supprimés pour libérer de l’espace' })
  @ApiResponse({ status: 403, description: 'Suppression strictement réservée au compte ROOT' })
  async bulkDelete(@Body() body: { ids?: string[] }, @CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Suppression strictement réservée au compte ROOT');
    }
    return this.auditLogsService.bulkDelete(body?.ids || []);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Suppression d’un événement d’audit (ROOT EXCLUSIF)' })
  @ApiResponse({ status: 200, description: 'Log supprimé' })
  @ApiResponse({ status: 403, description: 'Suppression strictement réservée au compte ROOT' })
  async deleteById(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.roles?.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Suppression strictement réservée au compte ROOT');
    }
    return this.auditLogsService.deleteById(id);
  }
}
