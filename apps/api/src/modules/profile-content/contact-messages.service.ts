import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContactMessage } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  async createPublic(profileId: string, dto: CreateContactMessageDto): Promise<ContactMessage> {
    return this.prisma.unscoped.contactMessage.create({
      data: {
        profileId,
        senderName: dto.senderName,
        senderPhone: dto.senderPhone,
        senderEmail: dto.senderEmail,
        message: dto.message,
      },
    });
  }

  async listMine(accountId: string): Promise<ContactMessage[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.contactMessage.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(accountId: string, messageId: string): Promise<ContactMessage> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.contactMessage.findFirst({
      where: { id: messageId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Message not found.');
    }
    if (existing.readAt) {
      return existing;
    }
    return this.prisma.unscoped.contactMessage.update({ where: { id: messageId }, data: { readAt: new Date() } });
  }
}
