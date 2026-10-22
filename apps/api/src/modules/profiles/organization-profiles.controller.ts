import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Account } from '@nid/db';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import { CreateGrantDto } from './dto/create-grant.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

/**
 * A separate controller (not a method on OrganizationsController) so
 * ProfilesModule can own this route without OrganizationsModule ever
 * needing to import ProfilesModule back — see ProfilesModule's own
 * comment. Nest happily merges routes from multiple controllers under the
 * same 'v1/organizations' prefix as long as the full paths don't collide,
 * which they don't (OrganizationsController never declares a
 * ':id/profile' path).
 *
 * Every route here is AccountSessionGuard-only — an organization never
 * authenticates as itself (see Organization/OrganizationMembership's own
 * schema comments); a person's own Account, authorized by an ACTIVE +
 * isAdmin OrganizationMembership, acts for it. ProfilesService enforces
 * that authorization plus the Organization.isVerified gate on every call.
 */
@Controller('v1/organizations')
export class OrganizationProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @UseGuards(AccountSessionGuard)
  @Post(':id/profile')
  create(@CurrentAccount() account: Account, @Param('id') organizationId: string, @Body() dto: CreateProfileDto) {
    return this.profiles.createForOrganization(account.id, organizationId, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get(':id/profile')
  getMine(@CurrentAccount() account: Account, @Param('id') organizationId: string) {
    return this.profiles.getForOrganization(account.id, organizationId);
  }

  @UseGuards(AccountSessionGuard)
  @Patch(':id/profile')
  update(@CurrentAccount() account: Account, @Param('id') organizationId: string, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateForOrganization(account.id, organizationId, dto);
  }

  /** Same admin-only authorization as the routes above — ProfilesService.requireActiveAdmin() gates each call. */
  @UseGuards(AccountSessionGuard)
  @Post(':id/profile/grants')
  createGrant(@CurrentAccount() account: Account, @Param('id') organizationId: string, @Body() dto: CreateGrantDto) {
    return this.profiles.createGrantForOrganization(account.id, organizationId, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get(':id/profile/grants')
  listGrants(@CurrentAccount() account: Account, @Param('id') organizationId: string) {
    return this.profiles.listGrantsForOrganization(account.id, organizationId);
  }

  @UseGuards(AccountSessionGuard)
  @Delete(':id/profile/grants/:grantId')
  revokeGrant(
    @CurrentAccount() account: Account,
    @Param('id') organizationId: string,
    @Param('grantId') grantId: string,
  ) {
    return this.profiles.revokeGrantForOrganization(account.id, organizationId, grantId);
  }
}
