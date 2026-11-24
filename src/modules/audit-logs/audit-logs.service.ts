import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch entity snapshot before mutation
   */
  async getEntitySnapshot(tableName: string, id: string): Promise<any> {
    if (!tableName || !id) return null;

    const modelMap: Record<string, string> = {
      category: 'category',
      categories: 'category',
      brand: 'brand',
      brands: 'brand',
      product: 'product',
      products: 'product',
      user: 'user',
      users: 'user',
      order: 'order',
      orders: 'order',
      warehouse: 'warehouse',
      warehouses: 'warehouse',
      supplier: 'supplier',
      suppliers: 'supplier',
      coupon: 'coupon',
      coupons: 'coupon',
      characteristic: 'characteristic',
      characteristics: 'characteristic',
      variant: 'variantOption',
      variants: 'variantOption',
      role: 'role',
      roles: 'role',
    };

    const modelKey = modelMap[tableName.toLowerCase()];
    if (!modelKey || !(this.prisma as any)[modelKey]?.findUnique) return null;

    try {
      const record = await (this.prisma as any)[modelKey].findUnique({
        where: { id },
      });
      if (record) {
        const copy = { ...record };
        delete copy.password;
        delete copy.passwordHash;
        return copy;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Compute differential object between before and after
   */
  computeDiff(before: any, after: any): any {
    if (!before && !after) return null;
    if (!before) return { type: 'CREATED', data: after };
    if (!after) return { type: 'DELETED', previous: before };

    const changes: Record<string, { from: any; to: any }> = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      if (['updatedAt', 'createdAt', 'isUpdated', 'password', 'passwordHash'].includes(key)) continue;
      const oldVal = before[key];
      const newVal = after[key];
      if (oldVal !== undefined && newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { from: oldVal, to: newVal };
      }
    }

    return Object.keys(changes).length > 0 ? { modifiedFields: changes } : null;
  }

  /**
   * Immutably record an audit event into audit_logs table
   */
  async recordLog(dto: CreateAuditLogDto) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          actorId: dto.actorId || null,
          actorEmail: dto.actorEmail || null,
          actorName: dto.actorName || null,
          action: dto.action,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId || null,
          tableName: dto.tableName || null,
          description: dto.description || null,
          before: dto.before || null,
          after: dto.after || null,
          diffJson: dto.diffJson || null,
          ipAddress: dto.ipAddress || null,
          userAgent: dto.userAgent || null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Query and filter audit logs for the ROOT audit console
   */
  async findMany(query: QueryAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      action,
      resourceType,
      actorEmail,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { actorEmail: { contains: q, mode: 'insensitive' } },
        { actorName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { resourceId: { contains: q, mode: 'insensitive' } },
        { tableName: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (action && action !== 'ALL') {
      where.action = action;
    }

    if (resourceType && resourceType !== 'ALL') {
      where.resourceType = resourceType;
    }

    if (actorEmail && actorEmail !== 'ALL') {
      where.actorEmail = { contains: actorEmail, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        where.createdAt.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        where.createdAt.lte = e;
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve a single audit log entry by ID with full detail
   */
  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }

  /**
   * Real-time metrics and KPI aggregations for the ROOT dashboard
   */
  async getStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalLogs, todayLogs, criticalActions, uniqueActors, distinctActions, distinctResources] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ['DELETE', 'BULK_DELETE', 'RESTORE', 'SECURITY_ALERT', 'HARD_DELETE'] },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorEmail'],
        _count: { _all: true },
        where: { actorEmail: { not: null } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        _count: { _all: true },
      }),
    ]);

    return {
      totalLogs,
      todayLogs,
      criticalActions,
      uniqueActorsCount: uniqueActors.length,
      actions: distinctActions.map((a) => a.action).filter(Boolean).sort(),
      resourceTypes: distinctResources.map((r) => r.resourceType).filter(Boolean).sort(),
      actors: uniqueActors.map((a) => a.actorEmail).filter(Boolean).sort(),
    };
  }

  async deleteById(id: string) {
    await this.prisma.auditLog.deleteMany({ where: { id } });
    return { ok: true, deletedCount: 1 };
  }

  async bulkDelete(ids: string[]) {
    const cleanIds = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
    if (cleanIds.length === 0) {
      return { ok: true, deletedCount: 0 };
    }
    const res = await this.prisma.auditLog.deleteMany({
      where: { id: { in: cleanIds } },
    });
    return { ok: true, deletedCount: res.count };
  }
}
