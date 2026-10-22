import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum SubjectTypeDto {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
}

export class CreateSubjectDto {
  @IsEnum(SubjectTypeDto)
  type!: SubjectTypeDto;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  givenName?: string;

  @IsOptional()
  @IsString()
  familyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * A value the subject/tenant supplied, not independently checked — see
   * SubjectsService.getBadges(). Only meaningful for the DATE_OF_BIRTH
   * badge's SELF_ATTESTED fallback; EDUCATION/EMPLOYMENT have no
   * equivalent scalar field, so they're never self-attested.
   */
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  /**
   * The subject's claimed address — what address_gps_match compares a
   * reported current location against, and what address_utility_bill /
   * address_postal_otp confirm. Optional here the same way phone/
   * dateOfBirth are: unset unless the tenant collects it at subject
   * creation, and unenforced by any check until one of those methods
   * actually verifies it.
   */
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
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
