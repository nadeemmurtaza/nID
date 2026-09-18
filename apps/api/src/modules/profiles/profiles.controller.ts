import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
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

  /** Unauthenticated — apps/profile-ui's public /[slug] page. Must stay declared after 'me' above. */
  @Get(':slug')
  getPublicBySlug(@Param('slug') slug: string) {
    return this.profiles.getPublicBySlug(slug);
  }
}
