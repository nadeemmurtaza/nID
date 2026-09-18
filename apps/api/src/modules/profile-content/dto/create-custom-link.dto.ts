import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateCustomLinkDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
