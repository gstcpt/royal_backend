import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { sendSmtpMailWithAttachments } from '../storefront-cms/utils/pdf-smtp.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { SystemRole } from '@royal/shared-types';
import { invalidateUserSessionCache } from '../auth/strategies/jwt.strategy';

interface UserAssignmentRecord {
  warehouseIds?: string[];
  posIds?: string[];
  cashRegisterIds?: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if a user has the ROOT role
   */
  private async isUserRoot(userId: string): Promise<boolean> {
    const rootRole = await this.prisma.role.findUnique({
      where: { name: SystemRole.ROOT },
    });
    if (!rootRole) return false;

    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId: rootRole.id },
    });
    return !!userRole;
  }

  /**
   * Helper to check if any roleId in a list is the ROOT role
   */
  private async containsRootRole(roleIds: string[]): Promise<boolean> {
    if (!roleIds || roleIds.length === 0) return false;
    const rootRole = await this.prisma.role.findUnique({
      where: { name: SystemRole.ROOT },
    });
    if (!rootRole) return false;
    return roleIds.includes(rootRole.id);
  }

  private async loadAssignmentsMap(): Promise<Record<string, UserAssignmentRecord>> {
    try {
      const row = await this.prisma.settings.findUnique({ where: { key: 'sys.userAssignments' } });
      if (!row?.value) return {};
      const parsed = JSON.parse(row.value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async saveUserAssignments(
    userId: string,
    assignments: UserAssignmentRecord,
    updatedBy?: string,
  ) {
    const currentMap = await this.loadAssignmentsMap();
    const warehouseIds = Array.from(new Set((assignments.warehouseIds || []).filter(Boolean)));
    const posIds = Array.from(new Set((assignments.posIds || []).filter(Boolean)));
    const cashRegisterIds = Array.from(new Set((assignments.cashRegisterIds || []).filter(Boolean)));

    if (warehouseIds.length === 0 && posIds.length === 0 && cashRegisterIds.length === 0) {
      delete currentMap[userId];
    } else {
      currentMap[userId] = { warehouseIds, posIds, cashRegisterIds };
    }

    await this.prisma.settings.upsert({
      where: { key: 'sys.userAssignments' },
      update: { value: JSON.stringify(currentMap), group: 'system', updatedBy: updatedBy || 'ADMIN' },
      create: {
        key: 'sys.userAssignments',
        value: JSON.stringify(currentMap),
        group: 'system',
        isSecret: false,
        updatedBy: updatedBy || 'ADMIN',
      },
    });
  }

  /**
   * Resolve relational UserRole pairs plus full warehouse / showroom / cash register labels
   */
  private async resolveRelationalLocations(dto: {
    warehouseId?: string;
    warehouseIds?: string[];
    posId?: string;
    posIds?: string[];
    cashRegisterIds?: string[];
  }) {
    const warehouseIds = Array.from(
      new Set([
        ...(Array.isArray(dto.warehouseIds) ? dto.warehouseIds : []),
        ...(dto.warehouseId ? [dto.warehouseId] : []),
      ].filter(Boolean)),
    );
    const cashRegisterIds = Array.from(
      new Set((Array.isArray(dto.cashRegisterIds) ? dto.cashRegisterIds : []).filter(Boolean)),
    );
    const directPosIds = Array.from(
      new Set([
        ...(Array.isArray(dto.posIds) ? dto.posIds : []),
        ...(dto.posId ? [dto.posId] : []),
      ].filter(Boolean)),
    );

    let derivedRegisterPosIds: string[] = [];
    if (cashRegisterIds.length > 0) {
      const regs = await this.prisma.cashRegister.findMany({
        where: { id: { in: cashRegisterIds } },
        select: { posId: true },
      });
      derivedRegisterPosIds = regs.map((r) => r.posId).filter(Boolean);
    }

    const posIds = Array.from(new Set([...directPosIds, ...derivedRegisterPosIds]));
    return { warehouseIds, posIds, directPosIds, cashRegisterIds };
  }

  private async insertRoleLocations(
    tx: any,
    userId: string,
    roleIds: string[],
    warehouseIds: string[],
    posIds: string[],
    assignedBy?: string,
  ) {
    const combos = new Set<string>();
    const rows: Array<{
      userId: string;
      roleId: string;
      warehouseId: string | null;
      posId: string | null;
      assignedBy: string | null;
    }> = [];

    for (const roleId of roleIds) {
      if (warehouseIds.length === 0 && posIds.length === 0) {
        const key = `${roleId}|null|null`;
        if (!combos.has(key)) {
          combos.add(key);
          rows.push({ userId, roleId, warehouseId: null, posId: null, assignedBy: assignedBy || null });
        }
      } else {
        for (const wId of warehouseIds) {
          const key = `${roleId}|${wId}|null`;
          if (!combos.has(key)) {
            combos.add(key);
            rows.push({ userId, roleId, warehouseId: wId, posId: null, assignedBy: assignedBy || null });
          }
        }
        for (const pId of posIds) {
          const key = `${roleId}|null|${pId}`;
          if (!combos.has(key)) {
            combos.add(key);
            rows.push({ userId, roleId, warehouseId: null, posId: pId, assignedBy: assignedBy || null });
          }
        }
      }
    }

    for (const row of rows) {
      await tx.userRole.create({ data: row });
    }
  }

  /**
   * List users with pagination, text search and role filtering
   */
  async findMany(query: QueryUsersDto) {
    const { page = 1, limit = 20, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      const upperRole = role.toUpperCase();
      const roleAliases: Record<string, string[]> = {
        SUPERADMIN: ['SUPER_ADMIN'],
        SUPER_ADMIN: ['SUPER_ADMIN'],
        WEBSITE_MANAGER: ['WEBSITE_MANAGER'],
        ADMIN: ['ADMIN'],
        MAGASINIER: ['STOCK_MANAGER'],
        STOCK_MANAGER: ['STOCK_MANAGER'],
        CAISSIER: ['CASHIER'],
        CASHIER: ['CASHIER'],
        VENDEUR: ['SALESPERSON'],
        SALESPERSON: ['SALESPERSON'],
        FINANCIER: ['ACCOUNTANT'],
        ACCOUNTANT: ['ACCOUNTANT'],
        COMMERCIAL: ['COMMERCIAL'],
        MARKETING: ['MARKETING'],
        DELIVERY_MANAGER: ['DELIVERY_MANAGER'],
        DELIVERY_AGENT: ['DELIVERY_AGENT'],
        CLIENT: ['CLIENT'],
        ROOT: ['ROOT'],
      };
      const targetRoles = roleAliases[upperRole] || [role, upperRole];
      where.userRoles = {
        some: {
          role: {
            name: { in: targetRoles },
          },
        },
      };
    }

    const [total, users, assignmentsMap, warehousesList, posList, registersList] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            include: {
              role: true,
              warehouse: { select: { id: true, name: true, code: true } },
              pos: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.loadAssignmentsMap(),
      this.prisma.warehouse.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.pointOfSale.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.cashRegister.findMany({
        select: { id: true, name: true, posId: true, pos: { select: { name: true } } },
      }),
    ]);

    const warehouseById = new Map(warehousesList.map((w) => [w.id, w]));
    const posById = new Map(posList.map((p) => [p.id, p]));
    const regById = new Map(
      registersList.map((r) => [r.id, { id: r.id, name: r.name, posId: r.posId, posName: r.pos?.name || '' }]),
    );

    const formattedUsers = users.map((user) => {
      const saved = assignmentsMap[user.id] || {};
      const relWhIds = user.userRoles.map((ur) => ur.warehouse?.id).filter(Boolean) as string[];
      const relPosIds = user.userRoles.map((ur) => ur.pos?.id).filter(Boolean) as string[];
      const warehouseIds = Array.from(new Set([...(saved.warehouseIds || []), ...relWhIds]));
      const cashRegisterIds = Array.from(new Set(saved.cashRegisterIds || []));
      const posIds = Array.from(new Set([...(saved.posIds || []), ...(cashRegisterIds.length === 0 ? relPosIds : [])]));

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: Array.from(new Set(user.userRoles.map((ur) => ur.role.name))),
        roleDetails: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          displayName: ur.role.displayName,
          warehouse: ur.warehouse,
          pos: ur.pos,
        })),
        warehouseIds,
        posIds,
        cashRegisterIds,
        assignedWarehouses: warehouseIds.map((wid) => warehouseById.get(wid)).filter(Boolean),
        assignedShowrooms: posIds.map((pid) => posById.get(pid)).filter(Boolean),
        assignedCashRegisters: cashRegisterIds.map((cid) => regById.get(cid)).filter(Boolean),
      };
    });

    return {
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single user by ID with full role and permission breakdown
   */
  async findById(id: string) {
    const [user, assignmentsMap, warehousesList, posList, registersList] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id, deletedAt: null },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
              warehouse: { select: { id: true, name: true, code: true } },
              pos: { select: { id: true, name: true, code: true } },
            },
          },
          userPermissions: {
            include: {
              permission: true,
            },
          },
        },
      }),
      this.loadAssignmentsMap(),
      this.prisma.warehouse.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.pointOfSale.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.cashRegister.findMany({
        select: { id: true, name: true, posId: true, pos: { select: { name: true } } },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const roles = Array.from(new Set(user.userRoles.map((ur) => ur.role.name)));
    const isRoot = roles.includes(SystemRole.ROOT);

    let permissions: string[] = [];
    if (isRoot) {
      const allPerms = await this.prisma.permission.findMany();
      permissions = Array.from(
        new Set(
          allPerms.flatMap((p) => [
            `${p.module}.${p.action}`,
            `${p.resource}.${p.action}`,
          ]),
        ),
      );
    } else {
      const permSet = new Set<string>();
      for (const ur of user.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          permSet.add(`${rp.permission.module}.${rp.permission.action}`);
          permSet.add(`${rp.permission.resource}.${rp.permission.action}`);
        }
      }
      for (const up of user.userPermissions) {
        const k1 = `${up.permission.module}.${up.permission.action}`;
        const k2 = `${up.permission.resource}.${up.permission.action}`;
        if (up.granted) {
          permSet.add(k1);
          permSet.add(k2);
        } else {
          permSet.delete(k1);
          permSet.delete(k2);
        }
      }
      permissions = Array.from(permSet);
    }

    const saved = assignmentsMap[user.id] || {};
    const relWhIds = user.userRoles.map((ur) => ur.warehouse?.id).filter(Boolean) as string[];
    const relPosIds = user.userRoles.map((ur) => ur.pos?.id).filter(Boolean) as string[];
    const warehouseIds = Array.from(new Set([...(saved.warehouseIds || []), ...relWhIds]));
    const cashRegisterIds = Array.from(new Set(saved.cashRegisterIds || []));
    const posIds = Array.from(new Set([...(saved.posIds || []), ...(cashRegisterIds.length === 0 ? relPosIds : [])]));
    const warehouseById = new Map(warehousesList.map((w) => [w.id, w]));
    const posById = new Map(posList.map((p) => [p.id, p]));
    const regById = new Map(
      registersList.map((r) => [r.id, { id: r.id, name: r.name, posId: r.posId, posName: r.pos?.name || '' }]),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles,
      permissions,
      roleAssignments: user.userRoles.map((ur) => ({
        id: ur.id,
        roleId: ur.role.id,
        roleName: ur.role.name,
        roleDisplayName: ur.role.displayName,
        warehouse: ur.warehouse,
        pos: ur.pos,
      })),
      warehouseIds,
      posIds,
      cashRegisterIds,
      assignedWarehouses: warehouseIds.map((wid) => warehouseById.get(wid)).filter(Boolean),
      assignedShowrooms: posIds.map((pid) => posById.get(pid)).filter(Boolean),
      assignedCashRegisters: cashRegisterIds.map((cid) => regById.get(cid)).filter(Boolean),
    };
  }

  /**
   * Create a new user with assigned roles and location assignments
   */
  async create(createUserDto: CreateUserDto, currentUserId?: string) {
    const email = createUserDto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Un utilisateur existe déjà avec cet email');
    }

    // HARD-CODED ROOT PROTECTION: Cannot assign ROOT role via API
    if (createUserDto.roleIds && (await this.containsRootRole(createUserDto.roleIds))) {
      throw new ForbiddenException(
        "Le rôle ROOT ne peut jamais être assigné ou propagé via l'API",
      );
    }

    const passwordHash = await argon2.hash(createUserDto.password);

    let rolesToAssign = createUserDto.roleIds || [];
    if (rolesToAssign.length === 0) {
      const clientRole = await this.prisma.role.findUnique({
        where: { name: SystemRole.CLIENT },
      });
      if (clientRole) {
        rolesToAssign = [clientRole.id];
      }
    }

    const { warehouseIds, posIds, directPosIds, cashRegisterIds } =
      await this.resolveRelationalLocations(createUserDto);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          phone: createUserDto.phone || null,
          isActive: true,
          isEmailVerified: true,
        },
      });

      await this.insertRoleLocations(
        tx,
        created.id,
        rolesToAssign,
        warehouseIds,
        posIds,
        currentUserId,
      );

      return created;
    });

    await this.saveUserAssignments(
      newUser.id,
      { warehouseIds, posIds: directPosIds, cashRegisterIds },
      currentUserId,
    );

    return this.findById(newUser.id);
  }

  /**
   * Update an existing user with strict ROOT protection and multi-assignments
   */
  async update(id: string, updateUserDto: UpdateUserDto, currentUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { userRoles: { select: { roleId: true } } },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isTargetRoot = await this.isUserRoot(id);

    if (isTargetRoot) {
      if (updateUserDto.isActive === false) {
        throw new ForbiddenException(
          'Impossible de désactiver le compte ROOT principal',
        );
      }
      if (updateUserDto.roleIds) {
        throw new ForbiddenException(
          'Impossible de modifier les rôles assignés au compte ROOT',
        );
      }
      if (updateUserDto.password && currentUserId !== id) {
        throw new ForbiddenException(
          'Seul le titulaire du compte ROOT peut modifier son propre mot de passe',
        );
      }
    }

    if (updateUserDto.roleIds && (await this.containsRootRole(updateUserDto.roleIds))) {
      if (!isTargetRoot) {
        throw new ForbiddenException(
          "Le rôle ROOT ne peut jamais être assigné ou propagé via l'API",
        );
      }
    }

    if (updateUserDto.email && updateUserDto.email.toLowerCase() !== user.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email.toLowerCase() },
      });
      if (emailTaken) {
        throw new ConflictException('Cette adresse email est déjà utilisée');
      }
    }

    const nextPasswordHash =
      updateUserDto.password && updateUserDto.password.trim().length > 0
        ? await argon2.hash(updateUserDto.password.trim())
        : undefined;

    const hasAssignmentPayload =
      updateUserDto.warehouseIds !== undefined ||
      updateUserDto.warehouseId !== undefined ||
      updateUserDto.posIds !== undefined ||
      updateUserDto.posId !== undefined ||
      updateUserDto.cashRegisterIds !== undefined;

    const resolvedLocations = hasAssignmentPayload
      ? await this.resolveRelationalLocations(updateUserDto)
      : null;

    const effectiveRoleIds =
      updateUserDto.roleIds && updateUserDto.roleIds.length > 0
        ? updateUserDto.roleIds
        : Array.from(new Set(user.userRoles.map((ur) => ur.roleId)));

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          firstName: updateUserDto.firstName,
          lastName: updateUserDto.lastName,
          email: updateUserDto.email?.toLowerCase(),
          phone: updateUserDto.phone,
          avatar: updateUserDto.avatar,
          isActive: updateUserDto.isActive,
          ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
        },
      });

      if (nextPasswordHash) {
        await tx.refreshToken.updateMany({
          where: { userId: id },
          data: { isRevoked: true },
        });
      }

      if ((updateUserDto.roleIds || resolvedLocations) && !isTargetRoot) {
        const prevAssignments = (await this.loadAssignmentsMap())[id] || {};
        const locs = resolvedLocations || {
          warehouseIds: prevAssignments.warehouseIds || [],
          posIds: prevAssignments.posIds || [],
          directPosIds: prevAssignments.posIds || [],
          cashRegisterIds: prevAssignments.cashRegisterIds || [],
        };

        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        await this.insertRoleLocations(
          tx,
          id,
          effectiveRoleIds,
          locs.warehouseIds,
          locs.posIds,
          currentUserId,
        );
      }
    });

    if (resolvedLocations && !isTargetRoot) {
      await this.saveUserAssignments(
        id,
        {
          warehouseIds: resolvedLocations.warehouseIds,
          posIds: resolvedLocations.directPosIds,
          cashRegisterIds: resolvedLocations.cashRegisterIds,
        },
        currentUserId,
      );
    }

    if (nextPasswordHash || updateUserDto.roleIds || updateUserDto.isActive === false) {
      invalidateUserSessionCache(id);
    }

    return this.findById(id);
  }

  /**
   * Soft-delete a user with unbreakable ROOT protection
   */
  async delete(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // HARD-CODED ROOT PROTECTION: Never allow deletion of ROOT account
    const isTargetRoot = await this.isUserRoot(id);
    if (isTargetRoot) {
      throw new ForbiddenException(
        'Protection absolue : le compte ROOT ne peut JAMAIS être supprimé',
      );
    }

    // Soft delete user and deactivate all current sessions
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      await tx.session.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id },
        data: { isRevoked: true },
      });
    });

    invalidateUserSessionCache(id);

    return {
      success: true,
      message: 'Utilisateur supprimé avec succès',
    };
  }

  /**
   * Toggle active/locked status of a user
   */
  async toggleStatus(id: string, isActive?: boolean) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isTargetRoot = await this.isUserRoot(id);
    if (isTargetRoot) {
      throw new ForbiddenException(
        'Le statut du compte ROOT ne peut pas être modifié',
      );
    }

    const newActiveState = isActive !== undefined ? isActive : !user.isActive;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: newActiveState,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // If deactivated, revoke all active sessions immediately
    if (!newActiveState) {
      await Promise.all([
        this.prisma.session.updateMany({
          where: { userId: id },
          data: { isActive: false },
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId: id },
          data: { isRevoked: true },
        }),
      ]);
      invalidateUserSessionCache(id);
    }

    return {
      id: updated.id,
      email: updated.email,
      isActive: updated.isActive,
      message: updated.isActive
        ? 'Compte utilisateur activé et déverrouillé'
        : 'Compte utilisateur désactivé',
    };
  }

  private generateRandomSystemPassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%*';
    const all = upper + lower + digits + symbols;
    const chars = [
      upper[crypto.randomInt(upper.length)],
      lower[crypto.randomInt(lower.length)],
      digits[crypto.randomInt(digits.length)],
      symbols[crypto.randomInt(symbols.length)],
    ];
    while (chars.length < length) {
      chars.push(all[crypto.randomInt(all.length)]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return `Ryl-${chars.join('')}`;
  }

  /**
   * Regenerates a cryptographically strong password and sends it by SMTP email to the user.
   * Only persists the new password hash if SMTP delivery succeeds so the account is never locked out on mail error.
   */
  async resetPassword(id: string, currentUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isTargetRoot = await this.isUserRoot(id);
    if (isTargetRoot && currentUserId !== id) {
      throw new ForbiddenException(
        'Seul le compte ROOT peut réinitialiser son propre mot de passe.',
      );
    }

    const smtpRow = await this.prisma.settings.findUnique({ where: { key: 'sys.smtp' } });
    let smtpCfg: any = {};
    try {
      smtpCfg = smtpRow?.value ? JSON.parse(smtpRow.value) : {};
    } catch {
      smtpCfg = {};
    }

    if (!smtpCfg?.host || !smtpCfg?.user || !smtpCfg?.password) {
      throw new BadRequestException(
        'Configuration SMTP manquante dans Système > Paramètres > SMTP. Impossible d’envoyer le nouveau mot de passe par e-mail.',
      );
    }

    const generatedPassword = this.generateRandomSystemPassword(10);

    try {
      await sendSmtpMailWithAttachments(smtpCfg, {
        to: user.email,
        subject: 'Royal — Réinitialisation de votre mot de passe',
        htmlBody: `
          <div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #E6E1D6;border-radius:16px;padding:28px;background:#FFFFFF;color:#1D232E;">
            <div style="border-bottom:3px solid #C59B27;padding-bottom:12px;margin-bottom:20px;">
              <h2 style="margin:0;color:#1D232E;font-size:20px;">Royal — Électro de Maison</h2>
              <p style="margin:4px 0 0;color:#9A7414;font-size:12px;font-weight:700;">Nouveau mot de passe généré par l’administration</p>
            </div>
            <p style="font-size:14px;">Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p>
            <p style="font-size:13px;line-height:1.6;">
              Votre mot de passe d’accès à la plateforme <strong>Royal</strong> a été réinitialisé par un administrateur.
              Voici votre nouveau mot de passe temporaire :
            </p>
            <div style="margin:20px 0;padding:16px;background:#FBF6E8;border:1px solid #E6D6A6;border-radius:12px;text-align:center;">
              <div style="font-size:11px;text-transform:uppercase;color:#9A7414;font-weight:700;margin-bottom:6px;">Identifiant : ${user.email}</div>
              <span style="font-family:monospace;font-size:20px;font-weight:900;letter-spacing:1.5px;color:#1D232E;">${generatedPassword}</span>
            </div>
            <p style="font-size:12px;color:#64748B;">
              Par mesure de sécurité, toutes vos sessions précédentes ont été déconnectées.
              Nous vous recommandons de modifier ce mot de passe dès votre prochaine connexion dans votre profil.
            </p>
          </div>
        `,
      });
    } catch (err: any) {
      this.logger.warn(`Failed sending reset password email to ${user.email}: ${err?.message || err}`);
      throw new BadRequestException(
        `Échec d’envoi de l’e-mail à ${user.email} (${err?.message || 'erreur SMTP'}). Le mot de passe existant a été conservé.`,
      );
    }

    const passwordHash = await argon2.hash(generatedPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.session.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id },
        data: { isRevoked: true },
      });
    });

    invalidateUserSessionCache(id);

    return {
      success: true,
      userId: user.id,
      email: user.email,
      emailSent: true,
      message: `Nouveau mot de passe généré et envoyé par e-mail à ${user.email}.`,
    };
  }

  /**
   * Manually verify or unverify a user's email address from the admin console.
   */
  async setEmailVerification(id: string, isEmailVerified?: boolean) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const nextVerified =
      isEmailVerified !== undefined ? Boolean(isEmailVerified) : !user.isEmailVerified;

    if (!nextVerified && (await this.isUserRoot(id))) {
      throw new ForbiddenException(
        'Le compte ROOT doit rester vérifié en permanence.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isEmailVerified: nextVerified,
        ...(nextVerified ? { emailVerifyToken: null, emailVerifyExp: null } : {}),
      },
      select: { id: true, email: true, isEmailVerified: true },
    });

    invalidateUserSessionCache(id);

    return {
      success: true,
      id: updated.id,
      email: updated.email,
      isEmailVerified: updated.isEmailVerified,
      message: updated.isEmailVerified
        ? `E-mail vérifié pour ${updated.email}.`
        : `Vérification e-mail révoquée pour ${updated.email}.`,
    };
  }

  /**
   * Generates a 6-digit OTP verification code and sends it via SMTP to the user.
   */
  async adminSendVerificationCode(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const smtpRow = await this.prisma.settings.findUnique({ where: { key: 'sys.smtp' } });
    let smtpCfg: any = {};
    try {
      smtpCfg = smtpRow?.value ? JSON.parse(smtpRow.value) : {};
    } catch {
      smtpCfg = {};
    }

    if (!smtpCfg?.host || !smtpCfg?.user || !smtpCfg?.password) {
      throw new BadRequestException(
        'Configuration SMTP manquante dans Système > Paramètres > SMTP. Impossible d’envoyer le code de vérification.',
      );
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const tokenHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    await sendSmtpMailWithAttachments(smtpCfg, {
      to: user.email,
      subject: 'Royal — Code de vérification de votre adresse e-mail',
      htmlBody: `
        <div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #E6E1D6;border-radius:16px;padding:28px;background:#FFFFFF;color:#1D232E;">
          <div style="border-bottom:3px solid #C59B27;padding-bottom:12px;margin-bottom:20px;">
            <h2 style="margin:0;color:#1D232E;font-size:20px;">Royal — Électro de Maison</h2>
            <p style="margin:4px 0 0;color:#9A7414;font-size:12px;font-weight:700;">Vérification de votre adresse e-mail</p>
          </div>
          <p style="font-size:14px;">Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p>
          <p style="font-size:13px;line-height:1.6;">
            Utilisez le code de vérification à 6 chiffres ci-dessous pour confirmer votre adresse e-mail :
          </p>
          <div style="margin:20px 0;padding:16px;background:#FBF6E8;border:1px solid #E6D6A6;border-radius:12px;text-align:center;">
            <span style="font-family:monospace;font-size:28px;font-weight:900;letter-spacing:6px;color:#1D232E;">${otpCode}</span>
          </div>
          <p style="font-size:12px;color:#64748B;">Ce code est valable pendant 15 minutes.</p>
        </div>
      `,
    });

    await this.prisma.user.update({
      where: { id },
      data: {
        emailVerifyToken: tokenHash,
        emailVerifyExp: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return {
      success: true,
      sent: true,
      email: user.email,
      message: `Code de vérification à 6 chiffres envoyé à ${user.email}.`,
    };
  }
}
