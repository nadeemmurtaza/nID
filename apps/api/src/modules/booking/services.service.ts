import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nid/db';
import type { Service } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

/** What a Profile can be booked for — owner-managed, no RLS (same trust domain as Profile itself). */
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async create(accountId: string, dto: CreateServiceDto): Promise<Service> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.service.create({
      data: {
        profileId: profile.id,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        currency: dto.currency,
        isActive: dto.isActive,
      },
    });
  }

  async listMine(accountId: string): Promise<Service[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.service.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: 'asc' } });
  }

  async update(accountId: string, serviceId: string, dto: UpdateServiceDto): Promise<Service> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.service.findFirst({ where: { id: serviceId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Service not found.');
    }
    return this.prisma.unscoped.service.update({
      where: { id: serviceId },
      data: {
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        currency: dto.currency,
        isActive: dto.isActive,
      },
    });
  }

  async remove(accountId: string, serviceId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.service.findFirst({ where: { id: serviceId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Service not found.');
    }
    try {
      await this.prisma.unscoped.service.delete({ where: { id: serviceId } });
    } catch (err) {
      // Appointment.service has onDelete: Restrict (schema.prisma) — a
      // service with booking history is deactivated, not deleted.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('This service has existing appointments — deactivate it instead of deleting it.');
      }
      throw err;
    }
    return { deleted: true };
  }

  /** Public: what a profile currently offers to book, respecting Profile.showBooking. */
  async listPublicByProfileId(profileId: string): Promise<Service[]> {
    return this.prisma.unscoped.service.findMany({
      where: { profileId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
