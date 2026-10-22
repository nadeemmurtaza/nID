import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { TenantStaffController } from './tenant-staff.controller';
import { TenantStaffService } from './tenant-staff.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantStaffController],
  providers: [TenantStaffService],
})
export class TenantStaffModule {}
