import { IsEnum, IsInt, IsOptional, IsUrl, Min } from 'class-validator';

export enum SocialPlatformDto {
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  LINKEDIN = 'LINKEDIN',
  TWITTER = 'TWITTER',
  YOUTUBE = 'YOUTUBE',
  TIKTOK = 'TIKTOK',
  OTHER = 'OTHER',
}

export class CreateSocialLinkDto {
  @IsEnum(SocialPlatformDto)
  platform!: SocialPlatformDto;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
