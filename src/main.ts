import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function createNestApp() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Compression & Cookies
  app.use(compression());
  app.use(cookieParser());

  // CORS Configuration
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, x-session-id, x-guest-session',
  });

  // Global Prefix
  const apiPrefix = process.env.API_PREFIX || '/api/v1';
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // Global Filters & Interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable Graceful Shutdown
  app.enableShutdownHooks();

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Royal E-Commerce API')
    .setDescription('Enterprise E-Commerce & Commerce Management Platform REST API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Entrez votre access token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'État de santé et disponibilité de la plateforme')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix.replace(/^\//, '')}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  return { app, apiPrefix };
}

let cachedHandlerPromise: Promise<(req: any, res: any) => void> | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedHandlerPromise) {
    cachedHandlerPromise = createNestApp().then(async ({ app }) => {
      await app.init();
      return app.getHttpAdapter().getInstance();
    });
  }
  const instance = await cachedHandlerPromise;
  return instance(req, res);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const { app, apiPrefix } = await createNestApp();
  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Royal Backend API running on: http://localhost:${port}/${apiPrefix.replace(/^\//, '')}`);
  logger.log(`📚 Swagger Documentation accessible at: http://localhost:${port}/${apiPrefix.replace(/^\//, '')}/docs`);
}

if (!process.env.VERCEL) {
  bootstrap();
}
