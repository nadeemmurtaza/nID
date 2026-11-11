import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { DepartmentService } from './department.service';

@Controller('v1/departments')
@UseGuards(AccountSessionGuard)
export class DepartmentController {
  constructor(private readonly dept: DepartmentService) {}

  @Post()
  create(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Body() body: any) {
    return this.dept.createDepartment(account, tenantId, body);
  }

  @Get()
  list(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string) {
    return this.dept.listDepartments(account, tenantId);
  }

  @Get(':id')
  get(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.dept.getDepartment(account, tenantId, id);
  }

  @Patch(':id')
  update(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.dept.updateDepartment(account, tenantId, id, body);
  }

  @Post(':id/assign')
  assign(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.dept.assignDepartment(account, tenantId, id, body);
  }

  @Delete(':id/assign/:accountId')
  removeAssignment(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('id') id: string, @Param('accountId') accountId: string) {
    return this.dept.removeDepartmentAssignment(account, tenantId, id, accountId);
  }

  @Get('account/:accountId')
  getAccountDepartments(@CurrentAccount() account: Account, @Query('tenantId') tenantId: string, @Param('accountId') accountId: string) {
    return this.dept.getAccountDepartments(account, tenantId, accountId);
  }
}
