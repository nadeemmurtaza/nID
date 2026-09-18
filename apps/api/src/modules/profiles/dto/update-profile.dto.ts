import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ProfileCategoryDto, PROFILE_SLUG_PATTERN } from './create-profile.dto';

/** Every field optional — a PATCH only touches what it sends. */
export class UpdateProfileDto {
  @IsOptional()
  @Matches(PROFILE_SLUG_PATTERN, {
    message: 'slug must be lowercase letters, numbers and hyphens only, and cannot start or end with a hyphen.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsEnum(ProfileCategoryDto)
  category?: ProfileCategoryDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  publicEmail?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  showWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  showAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  showBadges?: boolean;

  @IsOptional()
  @IsBoolean()
  showBooking?: boolean;

  @IsOptional()
  @IsBoolean()
  showOffers?: boolean;

  @IsOptional()
  @IsBoolean()
  showHours?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
