import { IsDateString, IsString } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString()
  serviceId!: string;

  /** Calendar date (YYYY-MM-DD), interpreted in the Profile's own timezone. */
  @IsDateString({ strict: true }, { message: 'from must be a YYYY-MM-DD date.' })
  from!: string;

  @IsDateString({ strict: true }, { message: 'to must be a YYYY-MM-DD date.' })
  to!: string;
}
