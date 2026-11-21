import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogsService } from '../../modules/audit-logs/audit-logs.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const { method, originalUrl, body, ip, headers } = req as any;

    // Only audit mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Ignore audit-logs own endpoint to avoid loops
    if (originalUrl?.includes('/audit-logs')) {
      return next.handle();
    }

    const user = (req as any).user;
    const actorId = user?.id || user?.sub || null;
    const actorEmail = user?.email || (actorId ? `user_${actorId}` : 'ANONYMOUS');
    const actorName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : actorEmail.includes('root')
        ? 'Root Administrator'
        : user?.firstName || 'Opérateur Système';

    let action = 'UPDATE';
    if (method === 'POST') action = 'CREATE';
    if (method === 'DELETE') action = 'DELETE';
    if (
      body?.isActive !== undefined ||
      body?.status !== undefined ||
      originalUrl.includes('toggle') ||
      originalUrl.includes('status')
    ) {
      action = 'TOGGLE_VISIBILITY';
    }
    if (originalUrl.includes('login')) action = 'LOGIN';
    if (originalUrl.includes('logout')) action = 'LOGOUT';
    if (originalUrl.includes('refresh')) action = 'REFRESH_TOKEN';

    // Extract resource type and ID from URL (e.g. /api/v1/categories/cmwdb... -> CATEGORY, cmwdb...)
    const cleanUrl = originalUrl.split('?')[0];
    const segments = cleanUrl.split('/').filter(Boolean);
    const v1Idx = segments.findIndex((s: string) => s === 'v1');
    const apiIdx = segments.findIndex((s: string) => s === 'api');
    const baseIdx = v1Idx !== -1 ? v1Idx + 1 : apiIdx !== -1 ? apiIdx + 1 : 0;

    const resourceSegment = segments[baseIdx] || 'SYSTEM';
    const rawId = segments[baseIdx + 1];
    const isSpecialAction = ['login', 'logout', 'refresh', 'me', 'profile'].includes(rawId?.toLowerCase());
    const resourceType = resourceSegment.toUpperCase().replace(/-/g, '_');
    const resourceId = isSpecialAction ? null : rawId || body?.id || null;
    const tableName = resourceSegment.toLowerCase();

    // Sanitize body (strip passwords)
    const sanitizedBody = body ? { ...body } : null;
    if (sanitizedBody?.password) sanitizedBody.password = '[PROTECTED]';
    if (sanitizedBody?.passwordHash) sanitizedBody.passwordHash = '[PROTECTED]';

    const clientIp = (ip || headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') as string;
    const userAgent = (headers['user-agent'] as string) || 'Royal-Client';

    // Pre-fetch before state if mutating existing entity
    return from(
      ['PUT', 'PATCH', 'DELETE'].includes(method) && resourceId
        ? this.auditLogsService.getEntitySnapshot(tableName, resourceId)
        : Promise.resolve(null),
    ).pipe(
      switchMap((beforeSnapshot) =>
        next.handle().pipe(
          tap({
            next: (resData) => {
              const afterData = resData?.data !== undefined ? resData.data : resData;
              const diff = this.auditLogsService.computeDiff(
                beforeSnapshot,
                afterData || sanitizedBody,
              );

              let description = `Opération [${method}] ${originalUrl} complétée avec succès`;
              if (action === 'TOGGLE_VISIBILITY') {
                const isNowActive = body?.isActive ?? body?.status ?? true;
                description = `Bascule de visibilité [${resourceType}] #${resourceId} : ${
                  isNowActive ? 'En ligne' : 'Masqué de la boutique'
                }`;
              } else if (action === 'CREATE') {
                description = `Création de l'entité [${resourceType}] #${
                  resourceId || resData?.data?.id || resData?.id || 'Nouveau'
                }`;
              } else if (action === 'DELETE') {
                description = `Suppression de l'entité [${resourceType}] #${resourceId}`;
              } else if (action === 'UPDATE') {
                description = `Mise à jour de l'entité [${resourceType}] #${resourceId}`;
              } else if (action === 'LOGIN') {
                description = `Connexion utilisateur réussie (${actorEmail})`;
              } else if (action === 'LOGOUT') {
                description = `Déconnexion utilisateur (${actorEmail})`;
              } else if (action === 'REFRESH_TOKEN') {
                description = `Rafraîchissement de session sécurisée (${actorEmail})`;
              }

              this.auditLogsService.recordLog({
                actorId,
                actorEmail,
                actorName,
                action,
                resourceType,
                resourceId: resourceId || resData?.data?.id || resData?.id || null,
                tableName,
                description,
                before: beforeSnapshot,
                after: afterData || sanitizedBody || null,
                diffJson: diff || (sanitizedBody ? { payload: sanitizedBody } : null),
                ipAddress: clientIp,
                userAgent,
              });
            },
            error: (err) => {
              this.auditLogsService.recordLog({
                actorId,
                actorEmail,
                actorName,
                action: `FAILED_${action}`,
                resourceType,
                resourceId,
                tableName,
                description: `Échec de l'opération [${method}] ${originalUrl} : ${
                  err?.message || 'Erreur non spécifiée'
                }`,
                before: beforeSnapshot,
                after: null,
                diffJson: { error: err?.message || 'Erreur', payload: sanitizedBody },
                ipAddress: clientIp,
                userAgent,
              });
            },
          }),
        ),
      ),
    );
  }
}
