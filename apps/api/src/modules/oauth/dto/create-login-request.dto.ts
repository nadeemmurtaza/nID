import { IsOptional, IsString } from 'class-validator';

export class CreateLoginRequestDto {
  @IsString()
  clientId!: string;

  @IsString()
  redirectUri!: string;

  @IsOptional()
  @IsString()
  state?: string;
}
