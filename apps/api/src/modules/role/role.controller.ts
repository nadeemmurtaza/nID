import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { RoleService } from './role.service';

@Controller('v1/roles')
@UseGuards(AccountSessionGuard)
export class RoleController {
  constructor(private readonly role: RoleService) {}

  @Post()
  create(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Body() body: any) {
    return this.role.createRole(account, tenantId, body);
  }

  @Get()
  list(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string) {
    return this.role.listRoles(account, tenantId);
  }

  @Get(':id')
  get(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.role.getRole(account, tenantId, id);
  }

  @Patch(':id')
  update(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.role.updateRole(account, tenantId, id, body);
  }

  @Delete(':id')
  delete(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.role.deleteRole(account, tenantId, id);
  }

  @Post(':id/assign')
  assign(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.role.assignRole(account, tenantId, id, body);
  }

  @Delete(':id/assign/:accountId')
  removeAssignment(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Param('accountId') accountId: string) {
    return this.role.removeRoleAssignment(account, tenantId, id, accountId);
  }

  @Get('account/:accountId')
  getAccountRoles(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('accountId') accountId: string) {
    return this.role.getAccountRoles(account, tenantId, accountId);
  }
}
