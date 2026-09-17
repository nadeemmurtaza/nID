import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { VerificationCasesController } from './verification-cases.controller';
import { VerificationCasesService } from './verification-cases.service';

@Module({
  imports: [AuthModule],
  controllers: [VerificationCasesController],
  providers: [VerificationCasesService],
})
export class VerificationCasesModule {}
