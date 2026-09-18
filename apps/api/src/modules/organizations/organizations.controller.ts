import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Account } from '@nid/db';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import { OrganizationsService } from './organizations.service';

/**
 * No class-level guard — this controller mixes two callers with
 * incompatible Authorization header formats (a tenant's own ApiKeyGuard
 * routes vs. a person's own AccountSessionGuard routes), so every method
 * declares its own @UseGuards, the same split verification-cases.controller.ts
 * already established (docs/PHASES.md's "Dashboard staff auth" section) —
 * stacking both class- and method-level guards on one route would run
 * ApiKeyGuard first and reject an Account session token before
 * AccountSessionGuard ever got a chance to look at it.
 */
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @UseGuards(ApiKeyGuard)
  @Get(':id')
  getById(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.organizations.getById(tenant.tenantId, tenant.apiKeyId, id);
  }

  @UseGuards(ApiKeyGuard)
  @Post(':id/members')
  addMember(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.organizations.addMember(tenant.tenantId, tenant.apiKeyId, id, dto);
  }

  @UseGuards(ApiKeyGuard)
  @Get(':id/members')
  listMembers(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.organizations.listMembers(tenant.tenantId, tenant.apiKeyId, id);
  }

  @UseGuards(ApiKeyGuard)
  @Post(':id/invite')
  invite(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string, @Body() dto: InviteEmployeeDto) {
    return this.organizations.invite(tenant.tenantId, tenant.apiKeyId, id, dto);
  }

  /**
   * A person's own view of what's been invited to them, across every
   * tenant/organization — reachable only with their own Account session,
   * never a tenant's API key (an organization never gets to enumerate
   * this; see OrganizationsService.listMyInvites()'s own comment).
   */
  @UseGuards(AccountSessionGuard)
  @Get('invites/mine')
  listMyInvites(@CurrentAccount() account: Account) {
    return this.organizations.listMyInvites(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('invites/:membershipId/accept')
  acceptInvite(@CurrentAccount() account: Account, @Param('membershipId') membershipId: string) {
    return this.organizations.respondToInvite(account.id, membershipId, 'ACCEPTED');
  }

  @UseGuards(AccountSessionGuard)
  @Post('invites/:membershipId/decline')
  declineInvite(@CurrentAccount() account: Account, @Param('membershipId') membershipId: string) {
    return this.organizations.respondToInvite(account.id, membershipId, 'DECLINED');
  }
}
