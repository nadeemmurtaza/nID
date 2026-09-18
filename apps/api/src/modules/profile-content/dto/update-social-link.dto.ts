import { IsEnum, IsInt, IsOptional, IsUrl, Min } from 'class-validator';
import { SocialPlatformDto } from './create-social-link.dto';

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsEnum(SocialPlatformDto)
  platform?: SocialPlatformDto;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
