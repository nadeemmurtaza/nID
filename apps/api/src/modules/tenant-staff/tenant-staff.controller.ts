import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { TenantStaffService } from './tenant-staff.service';

@UseGuards(ApiKeyGuard)
@Controller('v1/tenant-staff')
export class TenantStaffController {
  constructor(private readonly staff: TenantStaffService) {}

  @Post()
  invite(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: InviteStaffDto) {
    return this.staff.invite(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @Get()
  list(@CurrentTenant() tenant: AuthenticatedTenant) {
    return this.staff.list(tenant.tenantId, tenant.apiKeyId);
  }
}
