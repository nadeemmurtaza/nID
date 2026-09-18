import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { BadgesModule } from '../badges/badges.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrganizationProfilesController } from './organization-profiles.controller';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  // OrganizationsModule, not the reverse — see OrganizationProfilesController's
  // own header comment for why its routes live here instead of on
  // OrganizationsController (avoids a module import cycle).
  imports: [AccountsModule, BadgesModule, OrganizationsModule],
  controllers: [ProfilesController, OrganizationProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
