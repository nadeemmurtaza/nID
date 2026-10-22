import { IsString } from 'class-validator';

export class TokenExchangeDto {
  @IsString()
  code!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;

  @IsString()
  redirectUri!: string;
}
