import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProfileContentController } from './profile-content.controller';
import { OffersService } from './offers.service';
import { BusinessHoursService } from './business-hours.service';
import { LinksService } from './links.service';
import { ProfileImagesService } from './profile-images.service';
import { ContactMessagesService } from './contact-messages.service';

@Module({
  imports: [AccountsModule, ProfilesModule],
  controllers: [ProfileContentController],
  providers: [OffersService, BusinessHoursService, LinksService, ProfileImagesService, ContactMessagesService],
  exports: [OffersService, BusinessHoursService, LinksService, ProfileImagesService, ContactMessagesService],
})
export class ProfileContentModule {}
