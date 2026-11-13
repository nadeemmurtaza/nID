import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { AccessService } from './access.service';

@Controller('v1/access')
@UseGuards(AccountSessionGuard)
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post('grant')
  createGrant(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    return this.access.createGrant(account, tenantId, body);
  }

  @Get('grants')
  listGrants(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Query('organizationId') organizationId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.access.listGrants(account, tenantId, organizationId, brandId);
  }

  @Get('grant/:id')
  getGrant(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.access.getGrant(account, tenantId, id);
  }

  @Patch('grant/:id')
  updateGrant(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.access.updateGrant(account, tenantId, id, body);
  }

  @Delete('grant/:id')
  revokeGrant(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.access.revokeGrant(account, tenantId, id);
  }

  @Post('transfer-ownership')
  transferOwnership(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    return this.access.transferOwnership(account, tenantId, body);
  }

  @Post('partner')
  addPartner(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    return this.access.addPartner(account, tenantId, body.accountId, body.percentage);
  }

  @Get('my-permissions')
  getMyPermissions(
    @CurrentAccount() account: Account,
    @Query('tenantId') tenantId: string,
    @Query('organizationId') organizationId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.access.getMyPermissions(account, tenantId, organizationId, brandId);
  }
}
