import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Invites a phone number to join this Organization, pre-provisioning a
 * shell Account (unverified) if none exists yet for it — see
 * OrganizationsService.invite()'s own header comment for the full
 * "account control never moves off the person" reasoning. `isAdmin`
 * grants the resulting membership, once accepted, the right to manage
 * this Organization's brand Profile and invite further employees — see
 * OrganizationMembership.isAdmin's schema comment for why only a tenant's
 * own invite can ever set it.
 */
export class InviteEmployeeDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
