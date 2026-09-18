import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MaxLength(120)
  senderName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  senderPhone?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsString()
  @MaxLength(4000)
  message!: string;
}
