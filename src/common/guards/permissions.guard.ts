import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { SystemRole } from '@royal/shared-types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) {
      return false;
    }

    // ROOT & SUPER_ADMIN roles have complete system bypass
    if (
      user.roles &&
      (user.roles.includes(SystemRole.ROOT) ||
        user.roles.includes(SystemRole.SUPER_ADMIN))
    ) {
      return true;
    }

    return requiredPermissions.every((requirement) =>
      requirement
        .split('|')
        .map((candidate) => candidate.trim())
        .filter(Boolean)
        .some((permission) => this.matchesPermission(user.permissions, permission)),
    );
  }

  private matchesPermission(userPermissions: string[], permission: string): boolean {
    const normalizedDot = permission.replace(/:/g, '.');
    const normalizedColon = permission.replace(/\./g, ':');
    const [domain, action] = normalizedDot.split('.');
    const isReadLike = action === 'read' || action === 'view';
    return (
      userPermissions.includes(permission) ||
      userPermissions.includes(normalizedDot) ||
      userPermissions.includes(normalizedColon) ||
      (isReadLike &&
        (userPermissions.includes(`${domain}.read_list`) ||
          userPermissions.includes(`${domain}:read_list`) ||
          userPermissions.includes(`${domain}.read_detail`) ||
          userPermissions.includes(`${domain}:read_detail`) ||
          userPermissions.includes(`${domain}.read`) ||
          userPermissions.includes(`${domain}:read`))) ||
      userPermissions.includes(`${domain}.manage`) ||
      userPermissions.includes(`${domain}:manage`) ||
      userPermissions.includes('*')
    );
  }
}
