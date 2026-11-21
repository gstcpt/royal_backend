import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import { UserJwtPayload } from '@royal/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          return request?.cookies?.royal_access_token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || 'royal_jwt_super_access_secret_key_dev_2026!',
    });
  }

  async validate(payload: UserJwtPayload) {
    if (!payload || !payload.sub || !payload.sessionId) {
      throw new UnauthorizedException('Jeton invalide');
    }

    // Verify session in database
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            deletedAt: true,
            lockedUntil: true,
          },
        },
      },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée ou fermée');
    }

    if (!session.user || !session.user.isActive || session.user.deletedAt) {
      throw new UnauthorizedException('Compte utilisateur désactivé ou supprimé');
    }

    if (session.user.lockedUntil && session.user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Compte temporairement verrouillé');
    }

    // Update lastActiveAt in session (asynchronous, without awaiting to not block)
    this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => null);

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      warehouseId: payload.warehouseId || null,
      posId: payload.posId || null,
      sessionId: payload.sessionId,
    };
  }
}
