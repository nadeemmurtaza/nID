import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { WeekdayDto } from './create-availability-rule.dto';

export class UpdateAvailabilityRuleDto {
  @IsOptional()
  @IsEnum(WeekdayDto)
  day?: WeekdayDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
