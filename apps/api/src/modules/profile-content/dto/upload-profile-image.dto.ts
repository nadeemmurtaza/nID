import { IsEnum } from 'class-validator';

export enum ProfileImageKindDto {
  BANNER = 'BANNER',
  GALLERY = 'GALLERY',
}

export class UploadProfileImageDto {
  @IsEnum(ProfileImageKindDto)
  kind!: ProfileImageKindDto;
}
