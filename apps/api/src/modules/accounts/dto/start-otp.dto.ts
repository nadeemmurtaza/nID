import { IsString, Length } from 'class-validator';

export class StartOtpDto {
  @IsString()
  @Length(6, 32)
  phone!: string;
}
