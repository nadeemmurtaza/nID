import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ServicesService } from './services.service';
import { AvailabilityService } from './availability.service';
import { AppointmentsService } from './appointments.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

/**
 * Every owner (/me/*) route below must stay declared before the public
 * /:slug/* routes at the bottom of this file — Nest/Express matches routes
 * in declaration order, and a 2-segment /v1/profiles/me/services would
 * otherwise never be reachable ahead of /v1/profiles/:slug/services.
 */
@Controller('v1/profiles')
export class BookingController {
  constructor(
    private readonly services: ServicesService,
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(AccountSessionGuard)
  @Post('me/services')
  createService(@CurrentAccount() account: Account, @Body() dto: CreateServiceDto) {
    return this.services.create(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/services')
  listMyServices(@CurrentAccount() account: Account) {
    return this.services.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me/services/:id')
  updateService(@CurrentAccount() account: Account, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(account.id, id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/services/:id')
  removeService(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.services.remove(account.id, id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/availability-rules')
  createAvailabilityRule(@CurrentAccount() account: Account, @Body() dto: CreateAvailabilityRuleDto) {
    return this.availability.create(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/availability-rules')
  listMyAvailabilityRules(@CurrentAccount() account: Account) {
    return this.availability.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me/availability-rules/:id')
  updateAvailabilityRule(
    @CurrentAccount() account: Account,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.availability.update(account.id, id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/availability-rules/:id')
  removeAvailabilityRule(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.availability.remove(account.id, id);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/appointments')
  listMyAppointments(@CurrentAccount() account: Account) {
    return this.appointments.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/appointments/:id/confirm')
  confirmAppointment(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.appointments.confirm(account.id, id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/appointments/:id/cancel')
  cancelAppointment(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.appointments.cancel(account.id, id);
  }

  /** Public: what a profile currently offers to book. */
  @Get(':slug/services')
  async listPublicServices(@Param('slug') slug: string) {
    const profile = await this.getPublicBookableProfile(slug);
    return this.services.listPublicByProfileId(profile.id);
  }

  /** Public: real computed free/busy slots for one service over a date range. */
  @Get(':slug/availability')
  async getPublicAvailability(@Param('slug') slug: string, @Query() query: AvailabilityQueryDto) {
    const profile = await this.getPublicBookableProfile(slug);
    const service = await this.prisma.unscoped.service.findFirst({
      where: { id: query.serviceId, profileId: profile.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('That service is not available on this profile.');
    }
    return this.availability.computeFreeSlots(profile, service, query.from, query.to);
  }

  /** Public: book an appointment. */
  @Post(':slug/appointments')
  createPublicAppointment(@Param('slug') slug: string, @Body() dto: CreateAppointmentDto) {
    return this.appointments.createPublic(slug, dto);
  }

  private async getPublicBookableProfile(slug: string) {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { slug } });
    if (!profile || !profile.isPublished || !profile.showBooking) {
      throw new NotFoundException('This profile is not accepting bookings.');
    }
    return profile;
  }
}
