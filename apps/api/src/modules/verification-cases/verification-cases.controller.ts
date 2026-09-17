import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { CreateVerificationCaseDto } from './dto/create-verification-case.dto';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { VerificationCasesService } from './verification-cases.service';

@UseGuards(ApiKeyGuard)
@Controller('v1/verification-cases')
export class VerificationCasesController {
  constructor(private readonly cases: VerificationCasesService) {}

  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateVerificationCaseDto) {
    return this.cases.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @Get(':id')
  getById(@CurrentTenant() tenant: AuthenticatedTenant, @Param('id') id: string) {
    return this.cases.getById(tenant.tenantId, tenant.apiKeyId, id);
  }

  @Post(':id/otp/submit')
  submitOtp(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @Body() dto: SubmitOtpDto,
  ) {
    return this.cases.submitOtpCode(tenant.tenantId, tenant.apiKeyId, id, dto.code);
  }
}
