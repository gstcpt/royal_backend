import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions grouped by module
   */
  async findAll() {
    const permissions = await this.prisma.permission.findMany({
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
      });
    }

    return {
      total: permissions.length,
      modulesCount: Object.keys(grouped).length,
      modules: grouped,
    };
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
