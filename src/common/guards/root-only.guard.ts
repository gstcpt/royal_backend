import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SystemRole } from '@royal/shared-types';

/**
 * Enforces strict ROOT-only access prior to DTO ValidationPipe execution,
 * preventing SUPER_ADMIN bypass present in shared RolesGuard / PermissionsGuard.
 */
@Injectable()
export class RootOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userRoles: string[] = Array.isArray(req?.user?.roles)
      ? req.user.roles
          .map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name))
          .filter(Boolean)
      : [req?.user?.role].filter(Boolean);

    if (!userRoles.includes(SystemRole.ROOT)) {
      throw new ForbiddenException('Accès strictement réservé au compte ROOT.');
    }
    return true;
  }
}
