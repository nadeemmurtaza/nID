import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * The two policies seeded on the platform tenant (packages/db/prisma/seed.ts's
 * seedPlatformTenant) — deliberately a closed allowlist, not any policy
 * name a caller could type: this is a self-service endpoint with no
 * tenant-side review of which policy gets run, unlike the tenant-facing
 * POST /v1/verification-cases.
 */
const SELF_SERVICE_POLICIES = ['identity', 'cnic-phone-link'] as const;

export class CreateSelfVerificationCaseDto {
  @IsIn(SELF_SERVICE_POLICIES)
  policyName!: (typeof SELF_SERVICE_POLICIES)[number];

  /** Required for 'cnic-phone-link' (estamp_registry's referenceId — the CNIC). Ignored for 'identity'. */
  @IsOptional()
  @IsString()
  referenceId?: string;
}
