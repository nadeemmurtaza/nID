import { IsOptional, IsString, Length } from 'class-validator';

/**
 * Adds an existing Account as staff for this tenant. Deliberately requires
 * the phone to already have a real, verified Account (no "pending invite"
 * placeholder state) — same honesty standard as the rest of this codebase:
 * ask the person to sign in once at apps/login-ui or apps/profile-ui
 * first, then invite them, rather than inventing an unverified stand-in
 * identity.
 */
export class InviteStaffDto {
  @IsString()
  @Length(6, 32)
  phone!: string;

  @IsOptional()
  @IsString()
  role?: string;
}
