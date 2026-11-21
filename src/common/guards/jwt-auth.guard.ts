import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const req = context.switchToHttp().getRequest();
      if (req?.headers?.authorization?.startsWith('Bearer ')) {
        try {
          await super.canActivate(context);
        } catch {
          // Allow public route even if token is expired or invalid
        }
      }
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
