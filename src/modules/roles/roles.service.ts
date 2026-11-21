import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { SystemRole } from '@royal/shared-types';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all roles with user count and permission count
   */
  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
    }));
  }

  /**
   * Get single role by ID with associated permissions
   */
  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        resource: rp.permission.resource,
        action: rp.permission.action,
        scope: rp.permission.scope,
        description: rp.permission.description,
      })),
    };
  }

  /**
   * Create a new custom role
   */
  async create(createRoleDto: CreateRoleDto) {
    const name = createRoleDto.name.toUpperCase();

    if (name === SystemRole.ROOT) {
      throw new ForbiddenException(
        "Impossible de créer un rôle avec le nom réservé 'ROOT'",
      );
    }

    const existing = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Un rôle avec ce nom existe déjà');
    }

    const newRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name,
          displayName: createRoleDto.displayName,
          description: createRoleDto.description || null,
          isSystem: false,
        },
      });

      if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
        for (const permissionId of createRoleDto.permissionIds) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId,
            },
          });
        }
      }

      return role;
    });

    return this.findById(newRole.id);
  }

  /**
   * Update role metadata and permissions
   */
  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    // HARD-CODED ROOT PROTECTION: Cannot modify ROOT role
    if (role.name === SystemRole.ROOT) {
      throw new ForbiddenException(
        'Protection absolue : le rôle ROOT ne peut pas être modifié',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          displayName: updateRoleDto.displayName,
          description: updateRoleDto.description,
        },
      });

      if (updateRoleDto.permissionIds) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        for (const permissionId of updateRoleDto.permissionIds) {
          await tx.rolePermission.create({
            data: {
              roleId: id,
              permissionId,
            },
          });
        }
      }
    });

    return this.findById(id);
  }

  /**
   * Delete a custom role (system roles cannot be deleted)
   */
  async delete(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    if (role.isSystem || role.name === SystemRole.ROOT) {
      throw new ForbiddenException(
        'Impossible de supprimer un rôle système essentiel',
      );
    }

    // Check if any users are assigned to this role
    const usersCount = await this.prisma.userRole.count({
      where: { roleId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException(
        `Ce rôle est actuellement attribué à ${usersCount} utilisateur(s). Réassignez-les avant de supprimer.`,
      );
    }

    await this.prisma.role.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Rôle supprimé avec succès',
    };
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissions(id: string, assignPermissionsDto: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    if (role.name === SystemRole.ROOT) {
      throw new ForbiddenException(
        'Les permissions du rôle ROOT sont universelles et inaltérables',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      for (const permissionId of assignPermissionsDto.permissionIds) {
        await tx.rolePermission.create({
          data: {
            roleId: id,
            permissionId,
          },
        });
      }
    });

    return this.findById(id);
  }
}
