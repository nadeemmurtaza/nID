import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { SubmitSelfReportDto } from './dto/submit-self-report.dto';
import { SessionsService } from './sessions.service';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Liveness needs a short burst of frames, not one file — see SessionsService.submitLiveness(). */
const framesUploadInterceptor = FilesInterceptor('frames', 12, {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * No ApiKeyGuard here — this is what a subject's browser talks to
 * (apps/verify-ui), and a subject never holds the tenant's API key.
 * Authenticity comes from the session token in the URL itself, resolved by
 * SessionsService against VerificationSession.
 */
@Controller('v1/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get(':token')
  getStatus(@Param('token') token: string) {
    return this.sessions.getStatus(token);
  }

  @Post(':token/otp/submit')
  submitOtp(@Param('token') token: string, @Body() dto: SubmitOtpDto) {
    return this.sessions.submitOtp(token, dto.code);
  }

  @Post(':token/document/submit')
  @UseInterceptors(uploadInterceptor)
  submitDocument(@Param('token') token: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.sessions.submitDocument(token, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }

  @Post(':token/liveness/submit')
  @UseInterceptors(framesUploadInterceptor)
  submitLiveness(@Param('token') token: string, @UploadedFiles() files?: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No frames uploaded — expected multipart field "frames" (one or more files).');
    }
    return this.sessions.submitLiveness(
      token,
      files.map((file) => ({ buffer: file.buffer, contentType: file.mimetype, filename: file.originalname })),
    );
  }

  @Post(':token/claims/:method/submit')
  @UseInterceptors(uploadInterceptor)
  submitClaimDocument(
    @Param('token') token: string,
    @Param('method') method: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.sessions.submitClaimDocument(token, method, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }

  @Post(':token/claims/:method/report')
  submitSelfReport(@Param('token') token: string, @Param('method') method: string, @Body() dto: SubmitSelfReportDto) {
    return this.sessions.submitSelfReport(token, method, dto.reportedValue);
  }
}
