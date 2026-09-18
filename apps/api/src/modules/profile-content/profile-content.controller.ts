import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { OffersService } from './offers.service';
import { BusinessHoursService } from './business-hours.service';
import { LinksService } from './links.service';
import { ProfileImagesService } from './profile-images.service';
import { ContactMessagesService } from './contact-messages.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { WeekdayDto } from '../booking/dto/create-availability-rule.dto';
import { UpsertBusinessHourDto } from './dto/upsert-business-hour.dto';
import { CreateCustomLinkDto } from './dto/create-custom-link.dto';
import { UpdateCustomLinkDto } from './dto/update-custom-link.dto';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';
import { UploadProfileImageDto } from './dto/upload-profile-image.dto';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Owner (/me/*) routes must stay declared before the public /:slug/* routes — see booking.controller.ts's header comment. */
@Controller('v1/profiles')
export class ProfileContentController {
  constructor(
    private readonly offers: OffersService,
    private readonly businessHours: BusinessHoursService,
    private readonly links: LinksService,
    private readonly images: ProfileImagesService,
    private readonly contactMessages: ContactMessagesService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- offers (owner) ----

  @UseGuards(AccountSessionGuard)
  @Post('me/offers')
  createOffer(@CurrentAccount() account: Account, @Body() dto: CreateOfferDto) {
    return this.offers.create(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/offers')
  listMyOffers(@CurrentAccount() account: Account) {
    return this.offers.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me/offers/:id')
  updateOffer(@CurrentAccount() account: Account, @Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.offers.update(account.id, id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/offers/:id')
  removeOffer(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.offers.remove(account.id, id);
  }

  // ---- business hours (owner) ----

  @UseGuards(AccountSessionGuard)
  @Put('me/business-hours/:day')
  upsertBusinessHour(@CurrentAccount() account: Account, @Param('day') day: WeekdayDto, @Body() dto: UpsertBusinessHourDto) {
    return this.businessHours.upsert(account.id, day, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/business-hours')
  listMyBusinessHours(@CurrentAccount() account: Account) {
    return this.businessHours.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/business-hours/:day')
  removeBusinessHour(@CurrentAccount() account: Account, @Param('day') day: WeekdayDto) {
    return this.businessHours.remove(account.id, day);
  }

  // ---- links (owner) ----

  @UseGuards(AccountSessionGuard)
  @Post('me/links/custom')
  createCustomLink(@CurrentAccount() account: Account, @Body() dto: CreateCustomLinkDto) {
    return this.links.createCustomLink(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/links/custom')
  listMyCustomLinks(@CurrentAccount() account: Account) {
    return this.links.listMyCustomLinks(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me/links/custom/:id')
  updateCustomLink(@CurrentAccount() account: Account, @Param('id') id: string, @Body() dto: UpdateCustomLinkDto) {
    return this.links.updateCustomLink(account.id, id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/links/custom/:id')
  removeCustomLink(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.links.removeCustomLink(account.id, id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/links/social')
  createSocialLink(@CurrentAccount() account: Account, @Body() dto: CreateSocialLinkDto) {
    return this.links.createSocialLink(account.id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/links/social')
  listMySocialLinks(@CurrentAccount() account: Account) {
    return this.links.listMySocialLinks(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Patch('me/links/social/:id')
  updateSocialLink(@CurrentAccount() account: Account, @Param('id') id: string, @Body() dto: UpdateSocialLinkDto) {
    return this.links.updateSocialLink(account.id, id, dto);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/links/social/:id')
  removeSocialLink(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.links.removeSocialLink(account.id, id);
  }

  // ---- photo / gallery images (owner) ----

  @UseGuards(AccountSessionGuard)
  @Post('me/photo')
  @UseInterceptors(uploadInterceptor)
  async uploadPhoto(@CurrentAccount() account: Account, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.images.uploadPhoto(account.id, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/images')
  @UseInterceptors(uploadInterceptor)
  async uploadGalleryImage(
    @CurrentAccount() account: Account,
    @Query() query: UploadProfileImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected multipart field "file".');
    }
    return this.images.uploadGalleryImage(account.id, query.kind, {
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
  }

  @UseGuards(AccountSessionGuard)
  @Get('me/images')
  listMyImages(@CurrentAccount() account: Account) {
    return this.images.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Delete('me/images/:id')
  removeImage(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.images.remove(account.id, id);
  }

  // ---- contact messages (owner inbox) ----

  @UseGuards(AccountSessionGuard)
  @Get('me/contact-messages')
  listMyContactMessages(@CurrentAccount() account: Account) {
    return this.contactMessages.listMine(account.id);
  }

  @UseGuards(AccountSessionGuard)
  @Post('me/contact-messages/:id/read')
  markContactMessageRead(@CurrentAccount() account: Account, @Param('id') id: string) {
    return this.contactMessages.markRead(account.id, id);
  }

  // ---- public ----

  @Get(':slug/offers')
  async listPublicOffers(@Param('slug') slug: string) {
    const profile = await this.getPublishedProfile(slug);
    if (!profile.showOffers) {
      return [];
    }
    return this.offers.listPublicByProfileId(profile.id);
  }

  @Get(':slug/business-hours')
  async listPublicBusinessHours(@Param('slug') slug: string) {
    const profile = await this.getPublishedProfile(slug);
    if (!profile.showHours) {
      return [];
    }
    return this.businessHours.listPublicByProfileId(profile.id);
  }

  @Get(':slug/links')
  async listPublicLinks(@Param('slug') slug: string) {
    const profile = await this.getPublishedProfile(slug);
    const [customLinks, socialLinks] = await Promise.all([
      this.links.listPublicCustomLinksByProfileId(profile.id),
      this.links.listPublicSocialLinksByProfileId(profile.id),
    ]);
    return { customLinks, socialLinks };
  }

  @Get(':slug/photo')
  @Header('Cache-Control', 'public, max-age=300')
  async getPublicPhoto(@Param('slug') slug: string): Promise<StreamableFile> {
    const { body, contentType } = await this.images.getPublicPhoto(slug);
    return new StreamableFile(body, { type: contentType });
  }

  @Get(':slug/images')
  async listPublicImages(@Param('slug') slug: string) {
    const profile = await this.getPublishedProfile(slug);
    return this.images.listPublicByProfileId(profile.id);
  }

  @Get(':slug/images/:imageId')
  @Header('Cache-Control', 'public, max-age=300')
  async getPublicImage(@Param('slug') slug: string, @Param('imageId') imageId: string): Promise<StreamableFile> {
    const { body, contentType } = await this.images.getPublicImageBytes(slug, imageId);
    return new StreamableFile(body, { type: contentType });
  }

  @Post(':slug/contact-messages')
  async createPublicContactMessage(@Param('slug') slug: string, @Body() dto: CreateContactMessageDto) {
    const profile = await this.getPublishedProfile(slug);
    return this.contactMessages.createPublic(profile.id, dto);
  }

  private async getPublishedProfile(slug: string) {
    const profile = await this.prisma.unscoped.profile.findUnique({ where: { slug } });
    if (!profile || !profile.isPublished) {
      throw new NotFoundException('No published profile at this URL.');
    }
    return profile;
  }
}
