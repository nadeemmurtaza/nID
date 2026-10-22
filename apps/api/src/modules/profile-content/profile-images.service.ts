import { Injectable, NotFoundException } from '@nestjs/common';
import type { Profile, ProfileImage, ProfileImageKind } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { ProfilesService } from '../profiles/profiles.service';

export interface UploadedImageFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface StoredImage {
  body: Buffer;
  contentType: string;
}

@Injectable()
export class ProfileImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly profiles: ProfilesService,
  ) {}

  /** The main headshot/logo (Profile.photoKey) — replacing it overwrites, it doesn't add another row. */
  async uploadPhoto(accountId: string, file: UploadedImageFile): Promise<Profile> {
    const profile = await this.profiles.getMine(accountId);
    const stored = await this.storage.put({
      namespace: profile.id,
      groupId: 'photo',
      filename: file.filename,
      contentType: file.contentType,
      body: file.buffer,
    });
    return this.prisma.unscoped.profile.update({
      where: { id: profile.id },
      data: { photoKey: stored.key, photoContentType: stored.contentType },
    });
  }

  async getPublicPhoto(slug: string): Promise<StoredImage> {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { slug } });
    if (!profile || !profile.isPublished || !profile.photoKey || !profile.photoContentType) {
      throw new NotFoundException('No photo set for this profile.');
    }
    const body = await this.storage.get(profile.photoKey);
    return { body, contentType: profile.photoContentType };
  }

  /** Banner/gallery images — each upload adds a new ProfileImage row, appended to the end. */
  async uploadGalleryImage(accountId: string, kind: ProfileImageKind, file: UploadedImageFile): Promise<ProfileImage> {
    const profile = await this.profiles.getMine(accountId);
    const stored = await this.storage.put({
      namespace: profile.id,
      groupId: kind.toLowerCase(),
      filename: file.filename,
      contentType: file.contentType,
      body: file.buffer,
    });
    const last = await this.prisma.unscoped.profileImage.findFirst({
      where: { profileId: profile.id, kind },
      orderBy: { order: 'desc' },
    });
    return this.prisma.unscoped.profileImage.create({
      data: {
        profileId: profile.id,
        kind,
        storageKey: stored.key,
        contentType: stored.contentType,
        order: (last?.order ?? -1) + 1,
      },
    });
  }

  async listMine(accountId: string): Promise<ProfileImage[]> {
    const profile = await this.profiles.getMine(accountId);
    return this.prisma.unscoped.profileImage.findMany({
      where: { profileId: profile.id },
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
    });
  }

  async remove(accountId: string, imageId: string): Promise<{ deleted: true }> {
    const profile = await this.profiles.getMine(accountId);
    const existing = await this.prisma.unscoped.profileImage.findFirst({
      where: { id: imageId, profileId: profile.id },
    });
    if (!existing) {
      throw new NotFoundException('Image not found.');
    }
    await this.prisma.unscoped.profileImage.delete({ where: { id: imageId } });
    return { deleted: true };
  }

  async listPublicByProfileId(profileId: string, kind?: ProfileImageKind): Promise<ProfileImage[]> {
    return this.prisma.unscoped.profileImage.findMany({
      where: { profileId, kind },
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
    });
  }

  async getPublicImageBytes(slug: string, imageId: string): Promise<StoredImage> {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { slug } });
    if (!profile || !profile.isPublished) {
      throw new NotFoundException('Image not found.');
    }
    const image = await this.prisma.unscoped.profileImage.findFirst({ where: { id: imageId, profileId: profile.id } });
    if (!image) {
      throw new NotFoundException('Image not found.');
    }
    const body = await this.storage.get(image.storageKey);
    return { body, contentType: image.contentType };
  }
}
