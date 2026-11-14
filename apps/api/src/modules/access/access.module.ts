import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [TenantsModule, AccountsModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
