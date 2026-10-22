import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessHour } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { WeekdayDto } from '../booking/dto/create-availability-rule.dto';
import type { UpsertBusinessHourDto } from './dto/upsert-business-hour.dto';

/** Display-only hours — see schema.prisma's Weekday/BusinessHour comment distinguishing this from AvailabilityRule. */
@Injectable()
export class BusinessHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async upsert(accountId: string, day: WeekdayDto, dto: UpsertBusinessHourDto): Promise<BusinessHour> {
    const profile = await this.profiles.getMine(accountId);
    if (!dto.isClosed && (dto.openMinute === undefined || dto.closeMinute === undefined)) {
      throw new BadRequestException('openMinute and closeMinute are required unless isClosed is true.');
    }
    if (!dto.isClosed && dto.openMinute !== undefined && dto.closeMinute !== undefined && dto.closeMinute <= dto.openMinute) {
      throw new BadRequestException('closeMinute must be after openMinute.');
    }
    return this.prisma.unscoped.businessHour.upsert({
      where: { profileId_day: { profileId: profile.id, day } },
      create: {
        profileId: profile.id,
        day,
        openMinute: dto.openMinute,
        closeMinute: dto.closeMinute,
        isClosed: dto.isClosed ?? false,
      },
      update: {
        openMinute: dto.isClosed ? null : dto.openMinute,
        closeMinute: dto.isClosed ? null : dto.closeMinute,
        isClosed: dto.isClosed ?? false,
      },
    });
  }

  async listMine(accountId: string): Promise<BusinessHour[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.businessHour.findMany({ where: { profileId: profile.id }, orderBy: { day: 'asc' } });
  }

  async remove(accountId: string, day: WeekdayDto): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.businessHour.findUnique({
      where: { profileId_day: { profileId: profile.id, day } },
    });
    if (!existing) {
      throw new NotFoundException('No hours set for that day.');
    }
    await this.prisma.unscoped.businessHour.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async listPublicByProfileId(profileId: string): Promise<BusinessHour[]> {
    return this.prisma.unscoped.businessHour.findMany({ where: { profileId }, orderBy: { day: 'asc' } });
  }
}
