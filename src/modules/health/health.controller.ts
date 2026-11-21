import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Vérification de l’état de santé général du système' })
  @ApiResponse({ status: 200, description: 'Système opérationnel' })
  async check() {
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      name: process.env.APP_NAME || 'Royal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbStatus,
        memoryUsage: {
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (Docker / K8s)' })
  live() {
    return { status: 'alive' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
