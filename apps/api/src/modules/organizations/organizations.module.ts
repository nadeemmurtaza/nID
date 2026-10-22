import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  // AccountsModule directly, not just transitively through AuthModule —
  // AccountSessionGuard (used on this controller's invite-response routes)
  // needs to be visible in THIS module's own injector, the same DI gotcha
  // TenantActorGuard's rollout already documented (docs/PHASES.md).
  imports: [AuthModule, AccountsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
