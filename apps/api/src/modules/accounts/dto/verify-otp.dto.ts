import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(6, 32)
  phone!: string;

  @IsString()
  @Length(1, 32)
  code!: string;
}
