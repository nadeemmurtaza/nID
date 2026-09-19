import { Module } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { OptionalAccountSessionGuard } from '../../core/auth/optional-account-session.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountSessionGuard, OptionalAccountSessionGuard],
  exports: [AccountsService, AccountSessionGuard, OptionalAccountSessionGuard],
})
export class AccountsModule {}
