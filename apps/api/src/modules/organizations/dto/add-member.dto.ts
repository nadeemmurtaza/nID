import { IsOptional, IsString } from 'class-validator';

/**
 * The attestation act itself: whichever tenant API key is acting for this
 * Organization confirms `personSubjectId` is a real member (typically an
 * employee). This is what org_membership's provider requires before it
 * will let that person inherit a badge from the Organization's own
 * verification — see OrganizationMembershipProvider's header comment.
 */
export class AddMemberDto {
  @IsString()
  personSubjectId!: string;

  @IsOptional()
  @IsString()
  role?: string;
}
