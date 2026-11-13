import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AccountsModule } from '../accounts/accounts.module';
import { PlatformAdminGuard } from '../../core/auth/platform-admin.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  // AccountsModule alongside AuthModule: TenantActorGuard's own
  // AccountsService dependency must be visible in every module that uses
  // the guard directly, not just re-exported through AuthModule — see
  // TenantActorGuard's own note on this if it ever needs revisiting.
  // AuditModule: TenantsService records audit entries for tenant updates.
  // PlatformAdminGuard: protects platform-admin endpoints (create/list/update tenants).
  imports: [AuthModule, AccountsModule, AuditModule],
  controllers: [TenantsController],
  providers: [TenantsService, PlatformAdminGuard],
})
export class TenantsModule {}
