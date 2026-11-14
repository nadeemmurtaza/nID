import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [OrganizationsModule, AccountsModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
