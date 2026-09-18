import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  // AccountsModule alongside AuthModule: TenantActorGuard's own
  // AccountsService dependency must be visible in every module that uses
  // the guard directly, not just re-exported through AuthModule — see
  // TenantActorGuard's own note on this if it ever needs revisiting.
  imports: [AuthModule, AccountsModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
