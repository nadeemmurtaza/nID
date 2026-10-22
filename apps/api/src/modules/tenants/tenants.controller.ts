import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantActorGuard } from '../../core/auth/tenant-actor.guard';
import { CurrentActor } from '../../core/auth/current-actor.decorator';
import type { AuthenticatedActor } from '../../core/auth/types';
import { TenantsService } from './tenants.service';

/**
 * "Who is signed in" — apps/dashboard's own session check, on both a
 * tenant API key and a real staff Account session (TenantActorGuard is a
 * strict superset of ApiKeyGuard), since a real human logging in via
 * TenantStaffMembership needs to reach this exactly as an API key holder
 * always could.
 */
@UseGuards(TenantActorGuard)
@Controller('v1/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  getSelf(@CurrentActor() actor: AuthenticatedActor) {
    return this.tenants.getSelf(actor.tenantId, actor.actorType);
  }
}
