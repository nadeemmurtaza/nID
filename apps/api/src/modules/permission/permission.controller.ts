import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { PermissionService } from './permission.service';

@Controller('v1/permissions')
export class PermissionController {
  constructor(private readonly permission: PermissionService) {}

  @Get('catalog')
  getCatalog() {
    return this.permission.getCatalog();
  }

  @Get('all')
  getAll() {
    return this.permission.getAllPermissions();
  }

  @Get('group/:groupName')
  getGroup(@Param('groupName') groupName: string) {
    return this.permission.getGroupPermissions(groupName);
  }
}
