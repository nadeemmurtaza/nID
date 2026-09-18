import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nid/db';
import type { Appointment } from '@nid/db';
import { getLocalDateParts } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';

const MAX_SERIALIZATION_RETRIES = 3;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  /**
   * Public booking. The double-booking guard is a SERIALIZABLE transaction
   * with an explicit interval-overlap check (schema.prisma's comment on
   * Appointment explains why @@unique([profileId, startsAt]) alone can't
   * express "no overlap" between appointments of different durations) —
   * Postgres aborts one side of a genuine concurrent conflict with P2034
   * rather than letting both writes land, and we retry that side a few
   * times rather than surfacing a spurious failure for ordinary contention.
   */
  async createPublic(slug: string, dto: CreateAppointmentDto): Promise<Appointment> {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { slug } });
    if (!profile || !profile.isPublished || !profile.showBooking) {
      throw new NotFoundException('This profile is not accepting bookings.');
    }

    const service = await this.prisma.unscoped.service.findFirst({
      where: { id: dto.serviceId, profileId: profile.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('That service is not available on this profile.');
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt must be in the future.');
    }
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    const local = getLocalDateParts(startsAt, profile.timezone);
    const withinHours = await this.prisma.unscoped.availabilityRule.findFirst({
      where: {
        profileId: profile.id,
        day: local.weekday,
        isActive: true,
        startMinute: { lte: local.minuteOfDay },
        endMinute: { gte: local.minuteOfDay + service.durationMinutes },
      },
    });
    if (!withinHours) {
      throw new BadRequestException('That time is outside this profile\'s available hours.');
    }

    for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
      try {
        return await this.prisma.unscoped.$transaction(
          async (tx) => {
            const conflict = await tx.appointment.findFirst({
              where: {
                profileId: profile.id,
                status: { in: ['PENDING', 'CONFIRMED'] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            });
            if (conflict) {
              throw new ConflictException('That time is no longer available.');
            }
            return tx.appointment.create({
              data: {
                profileId: profile.id,
                serviceId: service.id,
                status: 'PENDING',
                startsAt,
                endsAt,
                visitorName: dto.visitorName,
                visitorPhone: dto.visitorPhone,
                visitorEmail: dto.visitorEmail,
                notes: dto.notes,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034' && attempt < MAX_SERIALIZATION_RETRIES) {
          continue;
        }
        throw err;
      }
    }
    // Unreachable — the loop above always returns or throws — but keeps TS's control-flow analysis happy.
    throw new ConflictException('That time is no longer available.');
  }

  async listMine(accountId: string): Promise<Appointment[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.appointment.findMany({
      where: { profileId: profile.id },
      orderBy: { startsAt: 'desc' },
      include: { service: true },
    });
  }

  async confirm(accountId: string, appointmentId: string): Promise<Appointment> {
    return this.transition(accountId, appointmentId, 'PENDING', 'CONFIRMED');
  }

  async cancel(accountId: string, appointmentId: string): Promise<Appointment> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.appointment.findFirst({
      where: { id: appointmentId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
      throw new ConflictException(`Cannot cancel an appointment that is already ${existing.status}.`);
    }
    return this.prisma.unscoped.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });
  }

  private async transition(
    accountId: string,
    appointmentId: string,
    fromStatus: Appointment['status'],
    toStatus: Appointment['status'],
  ): Promise<Appointment> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.appointment.findFirst({
      where: { id: appointmentId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found.');
    }
    if (existing.status !== fromStatus) {
      throw new ConflictException(`Appointment is ${existing.status}, not ${fromStatus}.`);
    }
    return this.prisma.unscoped.appointment.update({ where: { id: appointmentId }, data: { status: toStatus } });
  }
}
