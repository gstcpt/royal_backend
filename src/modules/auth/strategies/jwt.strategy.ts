import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import { UserJwtPayload } from '@royal/shared-types';

interface CachedSessionEntry {
  expiresAtMs: number;
  cacheUntilMs: number;
  lastDbWriteMs: number;
  userId: string;
}

const sessionValidationCache = new Map<string, CachedSessionEntry>();
const SESSION_CACHE_TTL_MS = 15_000;
const LAST_ACTIVE_DEBOUNCE_MS = 5 * 60_000;

export function invalidateSessionCache(sessionId?: string) {
  if (sessionId) {
    sessionValidationCache.delete(sessionId);
  }
}

export function invalidateUserSessionCache(userId?: string) {
  if (!userId) return;
  for (const [sid, entry] of sessionValidationCache.entries()) {
    if (entry.userId === userId) {
      sessionValidationCache.delete(sid);
    }
  }
}

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

    const now = Date.now();
    const cached = sessionValidationCache.get(payload.sessionId);

    if (cached && now < cached.cacheUntilMs && now < cached.expiresAtMs) {
      if (now - cached.lastDbWriteMs > LAST_ACTIVE_DEBOUNCE_MS) {
        cached.lastDbWriteMs = now;
        void this.prisma.session
          .update({
            where: { id: payload.sessionId },
            data: { lastActiveAt: new Date(now) },
          })
          .catch(() => null);
      }
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

    // Verify session in database when cache misses or expires
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        isActive: true,
        expiresAt: true,
        lastActiveAt: true,
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

    if (!session || !session.isActive || session.expiresAt.getTime() < now) {
      sessionValidationCache.delete(payload.sessionId);
      throw new UnauthorizedException('Session expirée ou fermée');
    }

    if (!session.user || !session.user.isActive || session.user.deletedAt) {
      sessionValidationCache.delete(payload.sessionId);
      throw new UnauthorizedException('Compte utilisateur désactivé ou supprimé');
    }

    if (session.user.lockedUntil && session.user.lockedUntil.getTime() > now) {
      sessionValidationCache.delete(payload.sessionId);
      throw new UnauthorizedException('Compte temporairement verrouillé');
    }

    const lastWrite = session.lastActiveAt ? session.lastActiveAt.getTime() : 0;
    const shouldWriteLastActive = now - lastWrite > LAST_ACTIVE_DEBOUNCE_MS;
    if (shouldWriteLastActive) {
      void this.prisma.session
        .update({
          where: { id: session.id },
          data: { lastActiveAt: new Date(now) },
        })
        .catch(() => null);
    }

    sessionValidationCache.set(payload.sessionId, {
      expiresAtMs: session.expiresAt.getTime(),
      cacheUntilMs: now + SESSION_CACHE_TTL_MS,
      lastDbWriteMs: shouldWriteLastActive ? now : lastWrite,
      userId: session.user.id,
    });

    if (sessionValidationCache.size > 2000) {
      const oldestKey = sessionValidationCache.keys().next().value;
      if (oldestKey) sessionValidationCache.delete(oldestKey);
    }

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
