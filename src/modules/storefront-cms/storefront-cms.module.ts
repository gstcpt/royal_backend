import { Module } from '@nestjs/common';
import { StorefrontCmsController } from './storefront-cms.controller';
import { CustomersController } from './customers.controller';
import { StorefrontCmsService } from './storefront-cms.service';

@Module({
  controllers: [StorefrontCmsController, CustomersController],
  providers: [StorefrontCmsService],
  exports: [StorefrontCmsService],
})
export class StorefrontCmsModule {}
