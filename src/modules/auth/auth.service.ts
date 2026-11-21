import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SystemRole } from '@royal/shared-types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Calculate SHA-256 hash for secure refresh token storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a cryptographically secure random token string
   */
  private generateSecureRandomToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  /**
   * Aggregate effective permissions for a user across roles and individual overrides
   */
  async getUserPermissionsAndRoles(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
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
      },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const isRoot = roles.includes(SystemRole.ROOT);

    // If ROOT, load ALL system permissions
    if (isRoot) {
      const allSystemPerms = await this.prisma.permission.findMany();
      const perms = Array.from(
        new Set(
          allSystemPerms.flatMap((p) => [
            `${p.module}.${p.action}`,
            `${p.resource}.${p.action}`,
          ]),
        ),
      );
      return {
        roles,
        permissions: perms,
        warehouseId: userRoles.find((ur) => ur.warehouseId)?.warehouseId || null,
        posId: userRoles.find((ur) => ur.posId)?.posId || null,
      };
    }

    // Collect permissions from assigned roles
    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(`${rp.permission.module}.${rp.permission.action}`);
        permissionSet.add(`${rp.permission.resource}.${rp.permission.action}`);
      }
    }

    // Apply individual UserPermission overrides
    const userOverrides = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    for (const override of userOverrides) {
      const permKey1 = `${override.permission.module}.${override.permission.action}`;
      const permKey2 = `${override.permission.resource}.${override.permission.action}`;
      if (override.granted) {
        permissionSet.add(permKey1);
        permissionSet.add(permKey2);
      } else {
        permissionSet.delete(permKey1);
        permissionSet.delete(permKey2);
      }
    }

    const primaryWarehouse = userRoles.find((ur) => ur.warehouseId)?.warehouseId || null;
    const primaryPos = userRoles.find((ur) => ur.posId)?.posId || null;

    return {
      roles,
      permissions: Array.from(permissionSet),
      warehouseId: primaryWarehouse,
      posId: primaryPos,
    };
  }

  /**
   * Validate user credentials with Argon2 and progressive account lockout
   */
  async validateUser(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Identifiants de connexion incorrects');
    }

    // Check account lockout status
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000),
      );
      throw new ForbiddenException(
        `Compte temporairement verrouillé pour des raisons de sécurité suite à des échecs répétés. Veuillez réessayer dans ${minutesRemaining} minute(s).`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Votre compte a été désactivé par l’administration de la plateforme.',
      );
    }

    // Verify Argon2 password hash
    const isPasswordValid = await argon2.verify(user.passwordHash, loginDto.password);

    if (!isPasswordValid) {
      const nextAttempts = user.loginAttempts + 1;
      const isLockingNow = nextAttempts >= 5;
      const lockedUntil = isLockingNow
        ? new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 minutes
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: nextAttempts,
          lockedUntil,
        },
      });

      if (isLockingNow) {
        this.logger.warn(`User ${user.email} account locked after 5 failed attempts`);
        throw new ForbiddenException(
          'Trop de tentatives échouées. Compte temporairement verrouillé pour 15 minutes.',
        );
      }

      throw new UnauthorizedException('Identifiants de connexion incorrects');
    }

    // Reset login attempts and record last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return user;
  }

  /**
   * Generate access and refresh tokens and persist session
   */
  async login(
    user: any,
    metadata?: { deviceInfo?: string; ipAddress?: string; userAgent?: string },
  ) {
    const { roles, permissions, warehouseId, posId } =
      await this.getUserPermissionsAndRoles(user.id);

    // Create a new active Session in DB (7-day duration)
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo: metadata?.deviceInfo || null,
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
        isActive: true,
        expiresAt: sessionExpiresAt,
      },
    });

    // Create a secure RefreshToken in DB
    const rawRefreshToken = this.generateSecureRandomToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        expiresAt: sessionExpiresAt,
      },
    });

    // Generate short-lived JWT Access Token (15 minutes)
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      warehouseId,
      posId,
      sessionId: session.id,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      expiresIn: '15m',
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'royal_jwt_super_access_secret_key_dev_2026!',
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        roles,
        permissions,
        warehouseId,
        posId,
      },
    };
  }

  /**
   * Register a new client user
   */
  async register(registerDto: RegisterDto, metadata?: { ipAddress?: string; userAgent?: string }) {
    const email = registerDto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Un compte existe déjà avec cette adresse email');
    }

    const passwordHash = await argon2.hash(registerDto.password);

    // Ensure CLIENT role exists
    let clientRole = await this.prisma.role.findUnique({
      where: { name: SystemRole.CLIENT },
    });

    if (!clientRole) {
      clientRole = await this.prisma.role.create({
        data: {
          name: SystemRole.CLIENT,
          displayName: 'Client',
          isSystem: true,
          description: 'Client final e-commerce',
        },
      });
    }

    const newUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone || null,
        isActive: true,
        isEmailVerified: false,
        userRoles: {
          create: {
            roleId: clientRole.id,
          },
        },
      },
    });

    // Link existing guest Customer profile or create a new Customer profile
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (existingCustomer) {
      if (!existingCustomer.userId) {
        await this.prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            userId: newUser.id,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phone: registerDto.phone || existingCustomer.phone,
          },
        });
      }
    } else {
      await this.prisma.customer.create({
        data: {
          userId: newUser.id,
          email,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phone: registerDto.phone || null,
        },
      });
    }

    // Log the user in immediately
    return this.login(newUser, metadata);
  }

  /**
   * Refresh JWT token with cryptographically secure token rotation
   */
  async refreshToken(
    rawRefreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token manquant');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existingRefreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!existingRefreshToken) {
      throw new UnauthorizedException('Jeton de rafraîchissement inconnu');
    }

    if (existingRefreshToken.isRevoked) {
      this.logger.warn(
        `Revoked refresh token reuse attempt detected for user ${existingRefreshToken.userId}! Revoking all sessions for security.`,
      );
      // Revoke all sessions of this user if an already revoked token is used (detect theft)
      await this.prisma.refreshToken.updateMany({
        where: { userId: existingRefreshToken.userId },
        data: { isRevoked: true },
      });
      await this.prisma.session.updateMany({
        where: { userId: existingRefreshToken.userId },
        data: { isActive: false },
      });
      throw new UnauthorizedException('Jeton révoqué. Déconnexion de sécurité effectuée.');
    }

    if (existingRefreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Jeton de rafraîchissement expiré');
    }

    const user = existingRefreshToken.user;
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Compte utilisateur inactif ou supprimé');
    }

    // Verify session
    const session = await this.prisma.session.findUnique({
      where: { id: existingRefreshToken.sessionId },
    });

    if (!session || !session.isActive) {
      throw new UnauthorizedException('Session inactive');
    }

    // Rotate refresh token: revoke current token and create a brand new one
    await this.prisma.refreshToken.update({
      where: { id: existingRefreshToken.id },
      data: { isRevoked: true },
    });

    const newRawRefreshToken = this.generateSecureRandomToken();
    const newTokenHash = this.hashToken(newRawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update session activity
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastActiveAt: new Date(),
        ipAddress: metadata?.ipAddress || session.ipAddress,
        userAgent: metadata?.userAgent || session.userAgent,
      },
    });

    // Issue new access token
    const { roles, permissions, warehouseId, posId } =
      await this.getUserPermissionsAndRoles(user.id);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
        permissions,
        warehouseId,
        posId,
        sessionId: session.id,
      },
      {
        expiresIn: '15m',
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'royal_jwt_super_access_secret_key_dev_2026!',
      },
    );

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Log out from a specific session and revoke its tokens
   */
  async logout(sessionId: string) {
    if (!sessionId) {
      return { success: true };
    }

    await this.prisma.session.updateMany({
      where: { id: sessionId },
      data: { isActive: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { isRevoked: true },
    });

    return {
      success: true,
      message: 'Déconnexion effectuée avec succès',
    };
  }

  /**
   * Log out from ALL sessions for a given user
   */
  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    return {
      success: true,
      message: 'Déconnexion de toutes les sessions effectuée avec succès',
    };
  }

  /**
   * Return the profile and full permissions of the authenticated user
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const { roles, permissions, warehouseId, posId } =
      await this.getUserPermissionsAndRoles(userId);

    return {
      ...user,
      roles,
      permissions,
      warehouseId,
      posId,
    };
  }

  /**
   * Change user password securely
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isMatch = await argon2.verify(user.passwordHash, changePasswordDto.currentPassword);
    if (!isMatch) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }

    const newHash = await argon2.hash(changePasswordDto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
      },
    });

    return {
      success: true,
      message: 'Mot de passe modifié avec succès',
    };
  }

  /**
   * List active sessions for an authenticated user
   */
  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Revoke a single session belonging to the user
   */
  async revokeUserSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { isRevoked: true },
    });

    return {
      success: true,
      message: 'Session révoquée avec succès',
    };
  }
}
