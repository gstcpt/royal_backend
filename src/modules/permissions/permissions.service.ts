import { Injectable, ConflictException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import {
  buildFrenchActionTitle,
  CANONICAL_RBAC_SECTIONS,
  scanWorkspaceRbacSurface,
  syncPermissionsViews,
} from './rbac-scanner.helper';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const existingCount = await this.prisma.permissionView.count();
      if (existingCount === 0) {
        const res = await syncPermissionsViews(this.prisma);
        this.logger.log(`Seeded permissions_views automatically (${res.upsertedCount} records).`);
      }
    } catch (err: any) {
      this.logger.warn(`RBAC startup sync skipped: ${err?.message || err}`);
    }
  }

  /**
   * Get all permissions grouped by module (with French titles & linked permissions_views)
   */
  async findAll() {
    const permissions = await this.prisma.permission.findMany({
      include: {
        permissionViews: {
          orderBy: [{ sectionOrder: 'asc' }, { viewPath: 'asc' }],
          select: {
            id: true,
            viewPath: true,
            viewLabelFr: true,
            sectionKey: true,
            sectionOrder: true,
            sectionLabelFr: true,
            actionTitleFr: true,
            backendRoute: true,
          },
        },
      },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push({
        id: perm.id,
        code: `${perm.module}.${perm.action}`,
        resource: perm.resource,
        action: perm.action,
        scope: perm.scope,
        description: perm.description,
        actionTitleFr:
          perm.permissionViews?.[0]?.actionTitleFr ||
          buildFrenchActionTitle(perm.module, perm.action),
        views: perm.permissionViews || [],
      });
    }

    return {
      total: permissions.length,
      modulesCount: Object.keys(grouped).length,
      modules: grouped,
    };
  }

  async listPermissionViews() {
    const items = await this.prisma.permissionView.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { viewPath: 'asc' }, { action: 'asc' }],
    });
    const sections = CANONICAL_RBAC_SECTIONS.map((sec) => ({
      order: sec.order,
      key: sec.key,
      labelFr: sec.labelFr,
      descriptionFr: sec.descriptionFr,
      viewsCount: sec.routes.length,
    }));
    return {
      total: items.length,
      sectionsCount: sections.length,
      sections,
      items,
    };
  }

  async scanAndSyncViews() {
    const syncResult = await syncPermissionsViews(this.prisma);
    const viewsData = await this.listPermissionViews();
    return {
      scan: syncResult,
      totalStored: viewsData.total,
      sections: viewsData.sections,
      items: viewsData.items,
    };
  }

  async inspectScannerSurface() {
    return scanWorkspaceRbacSurface();
  }

  /**
   * Get permissions for a specific module
   */
  async findByModule(moduleName: string) {
    const permissions = await this.prisma.permission.findMany({
      where: { module: moduleName.toLowerCase() },
      orderBy: { action: 'asc' },
    });

    return permissions.map((perm) => ({
      id: perm.id,
      code: `${perm.module}.${perm.action}`,
      action: perm.action,
      scope: perm.scope,
      description: perm.description,
    }));
  }

  async create(dto: CreatePermissionDto) {
    const mod = dto.module.trim().toLowerCase();
    const res = (dto.resource || mod).trim().toLowerCase();
    const act = dto.action.trim().toLowerCase();
    const scope = dto.scope?.trim() || null;

    const existing = await this.prisma.permission.findFirst({
      where: { module: mod, resource: res, action: act, scope },
    });
    if (existing) {
      throw new ConflictException(`La permission ${mod}.${act} existe déjà.`);
    }

    const perm = await this.prisma.permission.create({
      data: {
        module: mod,
        resource: res,
        action: act,
        scope,
        description: dto.description || `${mod}.${act}`,
      },
    });

    // Ensure ROOT role receives every newly created permission automatically
    const rootRole = await this.prisma.role.findUnique({ where: { name: 'ROOT' } });
    if (rootRole) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: rootRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: rootRole.id, permissionId: perm.id },
      });
    }

    return {
      id: perm.id,
      code: `${perm.module}.${perm.action}`,
      resource: perm.resource,
      action: perm.action,
      scope: perm.scope,
      description: perm.description,
    };
  }

  async delete(id: string) {
    const existing = await this.prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Permission introuvable.');
    await this.prisma.permission.delete({ where: { id } });
    return { deleted: true, id };
  }
}
