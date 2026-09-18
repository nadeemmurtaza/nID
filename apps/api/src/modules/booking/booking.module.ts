import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { BookingController } from './booking.controller';
import { ServicesService } from './services.service';
import { AvailabilityService } from './availability.service';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [AccountsModule, ProfilesModule],
  controllers: [BookingController],
  providers: [ServicesService, AvailabilityService, AppointmentsService],
  exports: [ServicesService, AvailabilityService, AppointmentsService],
})
export class BookingModule {}
