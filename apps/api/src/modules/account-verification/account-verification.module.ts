import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { BadgesModule } from '../badges/badges.module';
import { VerificationCasesModule } from '../verification-cases/verification-cases.module';
import { AccountVerificationController } from './account-verification.controller';
import { AccountVerificationService } from './account-verification.service';

@Module({
  imports: [AccountsModule, BadgesModule, VerificationCasesModule],
  controllers: [AccountVerificationController],
  providers: [AccountVerificationService],
})
export class AccountVerificationModule {}
