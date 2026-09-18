import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
