import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AvailabilityRule, Profile, Service } from '@nid/db';
import { zonedTimeToUtc } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import type { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';

const MAX_RANGE_DAYS = 31;

/** Sunday-first index, matching JS Date#getUTCDay() — used only to map a plain calendar date to a Weekday. */
const WEEKDAY_BY_INDEX = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** getUTCDay() always returns 0-6, so this array access always hits — asserted here once rather than at every call site. */
function weekdayForUtcDayIndex(dayIndex: number): (typeof WEEKDAY_BY_INDEX)[number] {
  const weekday = WEEKDAY_BY_INDEX[dayIndex];
  if (!weekday) {
    throw new Error(`Invalid UTC day index ${dayIndex}.`);
  }
  return weekday;
}

export interface FreeSlot {
  startsAt: string;
  endsAt: string;
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async create(accountId: string, dto: CreateAvailabilityRuleDto): Promise<AvailabilityRule> {
    const profile = await this.profiles.getMine(accountId);
    assertValidWindow(dto.startMinute, dto.endMinute);
    return this.prisma.unscoped.availabilityRule.create({
      data: {
        profileId: profile.id,
        day: dto.day,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        isActive: dto.isActive,
      },
    });
  }

  async listMine(accountId: string): Promise<AvailabilityRule[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.availabilityRule.findMany({
      where: { profileId: profile.id },
      orderBy: [{ day: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async update(accountId: string, ruleId: string, dto: UpdateAvailabilityRuleDto): Promise<AvailabilityRule> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.availabilityRule.findFirst({
      where: { id: ruleId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Availability rule not found.');
    }
    const startMinute = dto.startMinute ?? existing.startMinute;
    const endMinute = dto.endMinute ?? existing.endMinute;
    assertValidWindow(startMinute, endMinute);
    return this.prisma.unscoped.availabilityRule.update({
      where: { id: ruleId },
      data: { day: dto.day, startMinute: dto.startMinute, endMinute: dto.endMinute, isActive: dto.isActive },
    });
  }

  async remove(accountId: string, ruleId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.availabilityRule.findFirst({
      where: { id: ruleId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Availability rule not found.');
    }
    await this.prisma.unscoped.availabilityRule.delete({ where: { id: ruleId } });
    return { deleted: true };
  }

  /**
   * Real free/busy computation: recurring AvailabilityRules for the
   * requested calendar days, sliced into `service.durationMinutes`-sized
   * candidate slots, minus whatever's already booked — never a hardcoded
   * or synthetic slot list.
   */
  async computeFreeSlots(profile: Profile, service: Service, from: string, to: string): Promise<FreeSlot[]> {
    const [fromY, fromM, fromD] = parseCalendarDate(from);
    const [toY, toM, toD] = parseCalendarDate(to);
    const fromDayIndex = Date.UTC(fromY, fromM - 1, fromD);
    const toDayIndex = Date.UTC(toY, toM - 1, toD);
    if (toDayIndex < fromDayIndex) {
      throw new BadRequestException('"to" must not be before "from".');
    }
    const spanDays = Math.round((toDayIndex - fromDayIndex) / 86_400_000) + 1;
    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
    }

    const rules = await this.prisma.unscoped.availabilityRule.findMany({
      where: { profileId: profile.id, isActive: true },
    });
    if (rules.length === 0) {
      return [];
    }
    const rulesByDay = new Map<string, AvailabilityRule[]>();
    for (const rule of rules) {
      const list = rulesByDay.get(rule.day) ?? [];
      list.push(rule);
      rulesByDay.set(rule.day, list);
    }

    const now = Date.now();
    const candidates: FreeSlot[] = [];
    for (let dayMs = fromDayIndex; dayMs <= toDayIndex; dayMs += 86_400_000) {
      const d = new Date(dayMs);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const weekday = weekdayForUtcDayIndex(d.getUTCDay());

      for (const rule of rulesByDay.get(weekday) ?? []) {
        for (let m = rule.startMinute; m + service.durationMinutes <= rule.endMinute; m += service.durationMinutes) {
          const startsAt = zonedTimeToUtc(year, month, day, Math.floor(m / 60), m % 60, profile.timezone);
          if (startsAt.getTime() <= now) {
            continue;
          }
          const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
          candidates.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
        }
      }
    }
    if (candidates.length === 0) {
      return [];
    }

    const rangeStart = new Date(Math.min(...candidates.map((c) => new Date(c.startsAt).getTime())));
    const rangeEnd = new Date(Math.max(...candidates.map((c) => new Date(c.endsAt).getTime())));
    const booked = await this.prisma.unscoped.appointment.findMany({
      where: {
        profileId: profile.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    return candidates
      .filter((slot) => {
        const slotStart = new Date(slot.startsAt).getTime();
        const slotEnd = new Date(slot.endsAt).getTime();
        return !booked.some((b) => slotStart < b.endsAt.getTime() && slotEnd > b.startsAt.getTime());
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
}

function assertValidWindow(startMinute: number, endMinute: number): void {
  if (endMinute <= startMinute) {
    throw new BadRequestException('endMinute must be after startMinute.');
  }
}

function parseCalendarDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    throw new BadRequestException(`"${value}" is not a YYYY-MM-DD date.`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
