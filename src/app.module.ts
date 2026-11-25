import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CharacteristicsModule } from './modules/characteristics/characteristics.module';
import { VariantsModule } from './modules/variants/variants.module';
import { BrandsModule } from './modules/brands/brands.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProductsModule } from './modules/products/products.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';
import { PosModule } from './modules/pos/pos.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { StorefrontCmsModule } from './modules/storefront-cms/storefront-cms.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env.development', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CategoriesModule,
    CharacteristicsModule,
    VariantsModule,
    BrandsModule,
    SuppliersModule,
    ProductsModule,
    WarehousesModule,
    InventoryModule,
    StockTransfersModule,
    PosModule,
    CouponsModule,
    CartModule,
    OrdersModule,
    DeliveriesModule,
    AuditLogsModule,
    StorefrontCmsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
