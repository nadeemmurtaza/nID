import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

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
}
