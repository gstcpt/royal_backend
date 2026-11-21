import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [InventoryModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
