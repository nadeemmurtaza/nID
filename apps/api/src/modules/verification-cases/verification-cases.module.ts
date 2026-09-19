import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { VerificationCasesController } from './verification-cases.controller';
import { VerificationCasesService } from './verification-cases.service';

@Module({
  // AccountsModule alongside AuthModule — see TenantsModule's own comment
  // on why TenantActorGuard needs it directly imported, not just
  // re-exported through AuthModule.
  imports: [AuthModule, AccountsModule],
  controllers: [VerificationCasesController],
  providers: [VerificationCasesService],
  // AccountVerificationModule reuses this service for self-service case
  // creation (see its own header comment) rather than forking the logic.
  exports: [VerificationCasesService],
})
export class VerificationCasesModule {}
