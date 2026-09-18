import { Injectable, NotFoundException } from '@nestjs/common';
import type { CustomLink, SocialLink } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateCustomLinkDto } from './dto/create-custom-link.dto';
import type { UpdateCustomLinkDto } from './dto/update-custom-link.dto';
import type { CreateSocialLinkDto } from './dto/create-social-link.dto';
import type { UpdateSocialLinkDto } from './dto/update-social-link.dto';

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async createCustomLink(accountId: string, dto: CreateCustomLinkDto): Promise<CustomLink> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.customLink.create({
      data: { profileId: profile.id, label: dto.label, url: dto.url, order: dto.order },
    });
  }

  async listMyCustomLinks(accountId: string): Promise<CustomLink[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.customLink.findMany({ where: { profileId: profile.id }, orderBy: { order: 'asc' } });
  }

  async updateCustomLink(accountId: string, linkId: string, dto: UpdateCustomLinkDto): Promise<CustomLink> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.customLink.findFirst({ where: { id: linkId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Link not found.');
    }
    return this.prisma.unscoped.customLink.update({
      where: { id: linkId },
      data: { label: dto.label, url: dto.url, order: dto.order },
    });
  }

  async removeCustomLink(accountId: string, linkId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.customLink.findFirst({ where: { id: linkId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Link not found.');
    }
    await this.prisma.unscoped.customLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  listPublicCustomLinksByProfileId(profileId: string): Promise<CustomLink[]> {
    return this.prisma.unscoped.customLink.findMany({ where: { profileId }, orderBy: { order: 'asc' } });
  }

  async createSocialLink(accountId: string, dto: CreateSocialLinkDto): Promise<SocialLink> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.socialLink.create({
      data: { profileId: profile.id, platform: dto.platform, url: dto.url, order: dto.order },
    });
  }

  async listMySocialLinks(accountId: string): Promise<SocialLink[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.socialLink.findMany({ where: { profileId: profile.id }, orderBy: { order: 'asc' } });
  }

  async updateSocialLink(accountId: string, linkId: string, dto: UpdateSocialLinkDto): Promise<SocialLink> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.socialLink.findFirst({ where: { id: linkId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Link not found.');
    }
    return this.prisma.unscoped.socialLink.update({
      where: { id: linkId },
      data: { platform: dto.platform, url: dto.url, order: dto.order },
    });
  }

  async removeSocialLink(accountId: string, linkId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.socialLink.findFirst({ where: { id: linkId, profileId: profile.id } });
    if (!existing) {
      throw new NotFoundException('Link not found.');
    }
    await this.prisma.unscoped.socialLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  listPublicSocialLinksByProfileId(profileId: string): Promise<SocialLink[]> {
    return this.prisma.unscoped.socialLink.findMany({ where: { profileId }, orderBy: { order: 'asc' } });
  }
}
