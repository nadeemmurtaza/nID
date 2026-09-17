import { Module } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountSessionGuard],
  exports: [AccountsService, AccountSessionGuard],
})
export class AccountsModule {}
