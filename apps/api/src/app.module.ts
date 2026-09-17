import { Module } from '@nestjs/common';
import { PrismaModule } from './core/db/prisma.module';
import { AuditModule } from './core/audit/audit.module';
import { TemporalClientModule } from './core/temporal/temporal-client.module';
import { StorageModule } from './core/storage/storage.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { VerificationCasesModule } from './modules/verification-cases/verification-cases.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { OAuthModule } from './modules/oauth/oauth.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    TemporalClientModule,
    StorageModule,
    TenantsModule,
    SubjectsModule,
    VerificationCasesModule,
    SessionsModule,
    AccountsModule,
    OAuthModule,
  ],
})
export class AppModule {}
