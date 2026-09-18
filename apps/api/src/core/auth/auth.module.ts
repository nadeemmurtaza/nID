import { Module } from '@nestjs/common';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ApiKeyGuard } from './api-key.guard';
import { TenantActorGuard } from './tenant-actor.guard';

@Module({
  imports: [AccountsModule],
  providers: [ApiKeyGuard, TenantActorGuard],
  exports: [ApiKeyGuard, TenantActorGuard],
})
export class AuthModule {}
