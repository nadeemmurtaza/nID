import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { SessionsService } from './sessions.service';

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
}
