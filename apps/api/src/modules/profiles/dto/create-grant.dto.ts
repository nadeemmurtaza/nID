import { IsEnum, IsString, MaxLength } from 'class-validator';

export enum ProfileGrantFieldDto {
  PHONE = 'PHONE',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  ADDRESS = 'ADDRESS',
  REAL_NAME = 'REAL_NAME',
}

/**
 * The recipient is identified by their own nID username, not an internal
 * id or a phone number — every grantable person/organization already has
 * exactly one permanent slug (the username system itself), which is
 * exactly the stable handle "share this with one specific person or
 * organization" needs.
 */
export class CreateGrantDto {
  @IsEnum(ProfileGrantFieldDto)
  field!: ProfileGrantFieldDto;

  @IsString()
  @MaxLength(64)
  granteeSlug!: string;
}
