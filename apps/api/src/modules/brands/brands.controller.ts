import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { BrandsService, type CreateBrandDto, type UpdateBrandDto } from './brands.service';

@Controller('v1/brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  /**
   * Create a brand under the current account's organization.
   * The account must be an ACTIVE admin member of the organization.
   */
  @UseGuards(AccountSessionGuard)
  @Post()
  create(@CurrentAccount() account: Account, @Body() dto: CreateBrandDto) {
    return this.brands.create(account.id, dto);
  }

  /**
   * List all brands for a specific organization.
   * The account must be an ACTIVE member of the organization.
   */
  @UseGuards(AccountSessionGuard)
  @Get()
  list(
    @CurrentAccount() account: Account,
    @Query('organizationId') organizationId: string,
  ) {
    return this.brands.list(account.id, organizationId);
  }

  /**
   * Get a single brand by ID.
   * The account must be an ACTIVE member of the brand's organization.
   */
  @UseGuards(AccountSessionGuard)
  @Get(':id')
  getById(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.brands.getById(account.id, id);
  }

  /**
   * Update a brand. The account must be an ACTIVE admin of the brand's organization.
   */
  @UseGuards(AccountSessionGuard)
  @Patch(':id')
  update(
    @CurrentAccount() account: Account,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brands.update(account.id, id, dto);
  }

  /**
   * Delete (deactivate) a brand. The account must be an ACTIVE admin of the brand's organization.
   */
  @UseGuards(AccountSessionGuard)
  @Delete(':id')
  remove(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.brands.remove(account.id, id);
  }

  /**
   * List all brands across all organizations the account is a member of.
   * Useful for the work profile to show all brands the user works with.
   */
  @UseGuards(AccountSessionGuard)
  @Get('my-memberships')
  listMyMemberships(@CurrentAccount() account: Account) {
    return this.brands.listMyMemberships(account.id);
  }
}
