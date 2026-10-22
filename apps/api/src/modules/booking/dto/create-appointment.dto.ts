import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  serviceId!: string;

  /** The appointment's start instant — any ISO 8601 offset is accepted; only the instant matters. */
  @IsISO8601()
  startsAt!: string;

  @IsString()
  @MaxLength(120)
  visitorName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  visitorPhone?: string;

  @IsOptional()
  @IsEmail()
  visitorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
