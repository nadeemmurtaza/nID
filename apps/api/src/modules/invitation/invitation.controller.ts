import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { InvitationService } from './invitation.service';

@Controller('v1/invitations')
@UseGuards(AccountSessionGuard)
export class InvitationController {
  constructor(private readonly invitation: InvitationService) {}

  @Post('email')
  sendEmailInvite(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Body() body: any) {
    return this.invitation.sendEmailInvite(account, tenantId, body);
  }

  @Post('username')
  sendUsernameInvite(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Body() body: any) {
    return this.invitation.sendUsernameInvite(account, tenantId, body);
  }

  @Post('accept')
  acceptInvitation(@CurrentAccount() account: Account, @Body() body: any) {
    return this.invitation.acceptInvitation(account, body);
  }

  @Get()
  list(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.invitation.listInvitations(account, tenantId, status);
  }

  @Delete(':id')
  revoke(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.invitation.revokeInvitation(account, tenantId, id);
  }
}
