import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiKeyGuard } from '../../core/auth/api-key.guard';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
import type { AuthenticatedTenant } from '../../core/auth/types';
import { CreateVerificationCaseDto } from './dto/create-verification-case.dto';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { VerificationCasesService } from './verification-cases.service';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

@UseGuards(ApiKeyGuard)
@Controller('v1/verification-cases')
export class VerificationCasesController {
  constructor(private readonly cases: VerificationCasesService) {}

  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateVerificationCaseDto) {
    return this.cases.create(tenant.tenantId, tenant.apiKeyId, dto);
  }

  @Get()
  list(@CurrentTenant() tenant: AuthenticatedTenant) {
    return this.cases.list(tenant.tenantId, tenant.apiKeyId);
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

  @Post(':id/document/submit')
  @UseInterceptors(uploadInterceptor)
  submitDocument(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.cases.submitDocument(tenant.tenantId, tenant.apiKeyId, id, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }

  @Post(':id/liveness/submit')
  @UseInterceptors(uploadInterceptor)
  submitLiveness(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.cases.submitLiveness(tenant.tenantId, tenant.apiKeyId, id, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }
}
