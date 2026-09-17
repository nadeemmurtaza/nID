import { IsString, Length } from 'class-validator';

export class SubmitOtpDto {
  @IsString()
  @Length(1, 32)
  code!: string;
}
