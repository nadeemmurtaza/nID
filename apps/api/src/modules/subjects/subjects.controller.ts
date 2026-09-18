import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { TenantActorGuard } from '../../core/auth/tenant-actor.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import { CurrentActor } from '../../core/auth/current-actor.decorator';
import type { AuthenticatedTenant, AuthenticatedActor } from '../../core/auth/types';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectsService } from './subjects.service';

@Controller('v1/subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateSubjectDto) {
    return this.subjects.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @UseGuards(ApiKeyGuard)
  @Get(':id')
  getById(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.subjects.getById(tenant.tenantId, tenant.apiKeyId, id);
  }

  /** apps/dashboard's case-detail view reads this — a tenant API key or a real staff Account session (see TenantActorGuard). */
  @UseGuards(TenantActorGuard)
  @Get(':id/badges')
  getBadges(@CurrentActor() actor: AuthenticatedActor, @Param('id') id: string) {
    return this.subjects.getBadges(actor.tenantId, actor.actorType, actor.actorId, id);
  }

  @UseGuards(TenantActorGuard)
  @Get(':id/attribute-badges')
  getAttributeBadges(@CurrentActor() actor: AuthenticatedActor, @Param('id') id: string) {
    return this.subjects.getAttributeBadges(actor.tenantId, actor.actorType, actor.actorId, id);
  }
}
