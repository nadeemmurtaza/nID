import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { BadgesModule } from '../badges/badges.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [AccountsModule, BadgesModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
