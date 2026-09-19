import { IsEmail } from 'class-validator';

export class StartEmailVerificationDto {
  @IsEmail()
  email!: string;
}
