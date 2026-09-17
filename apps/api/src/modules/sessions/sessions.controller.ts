import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { SessionsService } from './sessions.service';

const uploadInterceptor = FileInterceptor('file', {
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
  @UseInterceptors(uploadInterceptor)
  submitLiveness(@Param('token') token: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.sessions.submitLiveness(token, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }
}
