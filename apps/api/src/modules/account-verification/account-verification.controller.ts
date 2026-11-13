import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Account } from '@nid/db';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import { AccountVerificationService } from './account-verification.service';
import { CreateSelfVerificationCaseDto } from './dto/create-self-verification-case.dto';

/** Every route here is an Account acting for itself — AccountSessionGuard only, never a tenant API key. */
@Controller('v1/accounts/me/verification')
@UseGuards(AccountSessionGuard)
export class AccountVerificationController {
  constructor(private readonly verification: AccountVerificationService) {}

  @Get()
  getStatus(@CurrentAccount() account: Account) {
    return this.verification.getStatus(account);
  }

  @Post('cases')
  createCase(@CurrentAccount() account: Account, @Body() dto: CreateSelfVerificationCaseDto) {
    return this.verification.createCase(account, dto);
  }

  @Get('cases')
  listCases(@CurrentAccount() account: Account) {
    return this.verification.listCases(account);
  }

  @Get('cases/:id')
  getCase(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.verification.getCase(account, id);
  }
}
