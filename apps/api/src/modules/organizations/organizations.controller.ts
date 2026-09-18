import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrganizationsService } from './organizations.service';

@UseGuards(ApiKeyGuard)
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @Get(':id')
  getById(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.organizations.getById(tenant.tenantId, tenant.apiKeyId, id);
  }

  @Post(':id/members')
  addMember(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.organizations.addMember(tenant.tenantId, tenant.apiKeyId, id, dto);
  }

  @Get(':id/members')
  listMembers(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.organizations.listMembers(tenant.tenantId, tenant.apiKeyId, id);
  }
}
