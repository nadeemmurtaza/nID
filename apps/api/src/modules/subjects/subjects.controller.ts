import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectsService } from './subjects.service';

@UseGuards(ApiKeyGuard)
@Controller('v1/subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateSubjectDto) {
    return this.subjects.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @Get(':id')
  getById(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.subjects.getById(tenant.tenantId, tenant.apiKeyId, id);
  }
}
