import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(1, 32)
  code!: string;
}
