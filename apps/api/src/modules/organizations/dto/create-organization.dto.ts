import { IsOptional, IsString } from 'class-validator';

/**
 * Creates the Organization's backing Subject (type ORGANIZATION) and its
 * Organization row in one step — mirrors CreateSubjectDto's shape for the
 * fields it shares, but an Organization is never created bare the way a
 * PERSON Subject can be: legalName is what a KYB case actually verifies.
 */
export class CreateOrganizationDto {
  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
