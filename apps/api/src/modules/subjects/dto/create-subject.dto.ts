import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

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
}
