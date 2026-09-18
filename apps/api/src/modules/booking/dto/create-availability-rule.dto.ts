import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum WeekdayDto {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export class CreateAvailabilityRuleDto {
  @IsEnum(WeekdayDto)
  day!: WeekdayDto;

  /** Minutes since midnight, local to the Profile's own timezone. */
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
