import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { TenantActorGuard } from '../../core/auth/tenant-actor.guard';
import { PlatformAdminGuard } from '../../core/auth/platform-admin.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import { CurrentActor } from '../../core/auth/current-actor.decorator';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedActor } from '../../core/auth/types';
import type { AuthenticatedTenant } from '../../core/auth/types';
import type { Account } from '@nid/db';
import {
  TenantsService,
  type CreateTenantDto,
  type UpdateTenantDto,
  type CreateTenantApiKeyDto,
  type InviteTenantStaffDto,
  type TenantMembership,
} from './tenants.service';

/**
 * "Who is signed in" — apps/dashboard's own session check, on both a
 * tenant API key and a real staff Account session (TenantActorGuard is a
 * strict superset of ApiKeyGuard), since a real human logging in via
 * TenantStaffMembership needs to reach this exactly as an API key holder
 * always could.
 */
@Controller('v1/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // ------------------------------------------------------------------
  // Tenant-self endpoint: "who am I?"
  // ------------------------------------------------------------------

  @UseGuards(TenantActorGuard)
  @Get('me')
  getSelf(@CurrentActor() actor: AuthenticatedActor) {
    return this.tenants.getSelf(actor.tenantId, actor.actorType);
  }

  // ------------------------------------------------------------------
  // Account-session endpoint: list all tenants this account is staff of
  // Used by profile-ui Work Profile tab to show tenant memberships
  // ------------------------------------------------------------------

  @UseGuards(AccountSessionGuard)
  @Get('my-memberships')
  getMyMemberships(@CurrentAccount() account: Account): Promise<TenantMembership[]> {
    return this.tenants.getMembershipsForAccount(account.id);
  }

  // ------------------------------------------------------------------
  // Platform-admin endpoints: create, list, update tenants
  // ------------------------------------------------------------------

  @UseGuards(PlatformAdminGuard)
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @UseGuards(PlatformAdminGuard)
  @Get()
  listAll() {
    return this.tenants.listAll();
  }

  @UseGuards(PlatformAdminGuard)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.tenants.getById(id);
  }

  @UseGuards(PlatformAdminGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  // ------------------------------------------------------------------
  // Tenant-admin endpoints: API keys, staff management
  // (requires tenant API key — the tenant manages its own resources)
  // ------------------------------------------------------------------

  @UseGuards(ApiKeyGuard)
  @Post(':id/api-keys')
  createApiKey(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @Body() dto: CreateTenantApiKeyDto,
  ) {
    // Only the tenant itself can create keys
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.createApiKey(id, dto);
  }

  @UseGuards(ApiKeyGuard)
  @Get(':id/api-keys')
  listApiKeys(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
  ) {
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.listApiKeys(id);
  }

  @UseGuards(ApiKeyGuard)
  @Delete(':id/api-keys/:apiKeyId')
  revokeApiKey(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.revokeApiKey(id, apiKeyId);
  }

  @UseGuards(ApiKeyGuard)
  @Post(':id/staff')
  inviteStaff(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @Body() dto: InviteTenantStaffDto,
  ) {
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.inviteStaff(id, dto);
  }

  @UseGuards(ApiKeyGuard)
  @Get(':id/staff')
  listStaff(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
  ) {
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.listStaff(id);
  }

  @UseGuards(ApiKeyGuard)
  @Delete(':id/staff/:accountId')
  removeStaff(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    if (tenant.tenantId !== id) {
      throw new Error('Unauthorized');
    }
    return this.tenants.removeStaff(id, accountId);
  }
}
