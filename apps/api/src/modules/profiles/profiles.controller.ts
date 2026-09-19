import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { OptionalAccountSessionGuard } from '../../core/auth/optional-account-session.guard';
import { CurrentAccount, CurrentAccountOptional } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { CreateGrantDto } from './dto/create-grant.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('v1/profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @UseGuards(AccountSessionGuard)
  @Post()
  create(@CurrentAccount() account: Account, @Body() dto: CreateProfileDto) {
    return this.profiles.create(account, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me')
  getMine(@CurrentAccount() account: Account) {
    return this.profiles.getMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me')
  update(@CurrentAccount() account: Account, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(account, dto);
  }

  /**
   * "User can show only one specific info to only one person or
   * organization by his own will" — the owner's own management of who
   * gets a private exception to their public show* defaults. All three
   * routes sit under /me, ahead of the :slug catch-all below, the same
   * "declare literal paths before the wildcard" rule RESERVED_PROFILE_SLUGS
   * already documents (no collision risk here since :slug only ever
   * matches a single path segment).
   */
  @UseGuards(AccountSessionGuard)
  @Post('me/grants')
  createGrant(@CurrentAccount() account: Account, @Body() dto: CreateGrantDto) {
    return this.profiles.createGrantForAccount(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/grants')
  listGrants(@CurrentAccount() account: Account) {
    return this.profiles.listGrantsForAccount(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/grants/:id')
  revokeGrant(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.profiles.revokeGrantForAccount(account.id, id);
  }

  /**
   * Unauthenticated-OR-authenticated — apps/profile-ui's public /[slug]
   * page. OptionalAccountSessionGuard never rejects the request; a valid
   * Bearer token just tells ProfilesService who the viewer is, so a
   * ProfileFieldGrant made out to them (directly, or via an Organization
   * they're an ACTIVE member of) can widen what's returned beyond the
   * owner's public show* defaults. Must stay declared after 'me' above.
   */
  @UseGuards(OptionalAccountSessionGuard)
  @Get(':slug')
  getPublicBySlug(@Param('slug') slug: string, @CurrentAccountOptional() viewer?: Account) {
    return this.profiles.getPublicBySlug(slug, viewer);
  }
}
