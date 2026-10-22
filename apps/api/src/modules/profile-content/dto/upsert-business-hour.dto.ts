import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpsertBusinessHourDto {
  /** Minutes since midnight, local to the Profile's own timezone. Omitted when isClosed. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  openMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  closeMinute?: number;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
