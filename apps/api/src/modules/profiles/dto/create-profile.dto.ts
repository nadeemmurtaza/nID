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

export enum ProfileCategoryDto {
  DOCTOR = 'DOCTOR',
  BUSINESS = 'BUSINESS',
  PROFESSIONAL = 'PROFESSIONAL',
  OTHER = 'OTHER',
}

/** Lowercase letters, numbers and internal hyphens — what a public URL path segment can safely be. */
export const PROFILE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export class CreateProfileDto {
  @Matches(PROFILE_SLUG_PATTERN, {
    message: 'slug must be lowercase letters, numbers and hyphens only, and cannot start or end with a hyphen.',
  })
  slug!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

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

  /** IANA timezone name — every AvailabilityRule/BusinessHour minute-of-day value is local to this. */
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

  /** "Privacy 1st" — the verified real name is private by default; the owner opts in explicitly. */
  @IsOptional()
  @IsBoolean()
  showRealName?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
