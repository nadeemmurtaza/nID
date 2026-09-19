import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount, CurrentSessionTokenHash } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { StartOtpDto } from './dto/start-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AccountsService } from './accounts.service';

@Controller('v1/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('otp/start')
  async startOtp(@Body() dto: StartOtpDto): Promise<{ accepted: true }> {
    await this.accounts.startOtp(dto.phone);
    return { accepted: true };
  }

  /** Verifying the first-ever code for a phone number both creates the Account and logs it in. */
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.accounts.verifyOtp(dto.phone, dto.code);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me')
  me(@CurrentAccount() account: Account) {
    return account;
  }

  /** Logs out the current device/session only. */
  @UseGuards(AccountSessionGuard)
  @Post('me/logout')
  @HttpCode(204)
  async logout(@CurrentSessionTokenHash() tokenHash: string): Promise<void> {
    await this.accounts.revokeSession(tokenHash);
  }

  /** Logs out every session on this Account — the recovery action if a session may have leaked. */
  @UseGuards(AccountSessionGuard)
  @Post('me/logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentAccount() account: Account): Promise<void> {
    await this.accounts.revokeAllSessions(account.id);
  }
}
