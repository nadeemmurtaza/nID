import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { TenantsService } from './tenants.service';

@UseGuards(ApiKeyGuard)
@Controller('v1/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  getSelf(@CurrentTenant() tenant: AuthenticatedTenant) {
    return this.tenants.getSelf(tenant.tenantId);
  }
}
