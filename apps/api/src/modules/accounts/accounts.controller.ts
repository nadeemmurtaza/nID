import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
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
}
