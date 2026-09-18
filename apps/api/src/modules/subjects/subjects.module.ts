import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  // AccountsModule alongside AuthModule — see TenantsModule's own comment
  // on why TenantActorGuard needs it directly imported.
  imports: [AuthModule, AccountsModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
