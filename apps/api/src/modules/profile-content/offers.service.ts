import { Injectable, NotFoundException } from '@nestjs/common';
import type { Offer } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { UpdateOfferDto } from './dto/update-offer.dto';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async create(accountId: string, dto: CreateOfferDto): Promise<Offer> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.offer.create({
      data: {
        profileId: profile.id,
        title: dto.title,
        description: dto.description,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async listMine(accountId: string): Promise<Offer[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.offer.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: 'desc' } });
  }

  async update(accountId: string, offerId: string, dto: UpdateOfferDto): Promise<Offer> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.offer.findFirst({ where: { id: offerId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Offer not found.');
    }
    return this.prisma.unscoped.offer.update({
      where: { id: offerId },
      data: {
        title: dto.title,
        description: dto.description,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async remove(accountId: string, offerId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.offer.findFirst({ where: { id: offerId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Offer not found.');
    }
    await this.prisma.unscoped.offer.delete({ where: { id: offerId } });
    return { deleted: true };
  }

  /** Public: live offers only — expired or deactivated ones are never shown. */
  async listPublicByProfileId(profileId: string): Promise<Offer[]> {
    return this.prisma.unscoped.offer.findMany({
      where: {
        profileId,
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
