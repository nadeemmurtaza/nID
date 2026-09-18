import type { PrismaClient } from '@nid/db';
import { withTenantContext } from '@nid/db';
import type { VerificationContext, VerificationMethodProvider, VerificationResult, PendingResult } from './types';

/**
 * "This person works at a verified organization, so they inherit its
 * verification" — a real, common KYC pattern (a trusted-employer / vouching
 * flow), not a shortcut. Every other provider in this package mirrors an
 * external vendor's HTTP contract (RegistryCheckProvider) or a subject's own
 * submission (ImageClaimProvider, SelfReportedCheckProvider); this one is
 * the first to look something up in nID's own data instead — the
 * Organization graph is first-party evidence exactly the way a vendor's API
 * response is, just queried directly rather than over HTTP.
 *
 * Two things both have to be true, and this provider refuses to guess at
 * either:
 *
 *  1. The claimed Organization must itself be verified — have at least one
 *     APPROVED VerificationCase for claimType IDENTITY (real KYB, not an
 *     assumption). An org merely existing as a row is not "verified."
 *  2. The subject must be a CONFIRMED member — an OrganizationMembership row
 *     at status ACTIVE, either created directly via
 *     POST /v1/organizations/:id/members or accepted by the person
 *     themselves after an invite (POST /v1/organizations/:id/invite +
 *     .../accept — see organizations.service.ts). PENDING (invited, not
 *     yet accepted) and DECLINED both fail this check exactly like no row
 *     at all — an invite the person hasn't acted on is no more proof than
 *     their own claimed organizationId is. The subject naming an
 *     organizationId in their own case input is a claim, not proof;
 *     nothing here trusts that claim on its own, same reasoning
 *     OrganizationBeneficialOwner already applies to KYB beneficial owners.
 *
 * Missing either one resolves to NEEDS_REVIEW, not FAILED — both are
 * legitimately "true but not yet provable to us" states (the org's KYB case
 * might be mid-flight; an admin might just not have confirmed the
 * membership yet), not evidence the claim is false.
 */
export class OrganizationMembershipProvider implements VerificationMethodProvider {
  readonly key = 'org_membership';
  readonly label = 'Verified-organization membership';

  constructor(private readonly prisma: PrismaClient) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    const organizationId = context.input['organizationId'];
    if (typeof organizationId !== 'string' || organizationId.length === 0) {
      return { status: 'FAILED', raw: { reason: 'missing_organization_id' }, verified: false };
    }

    return withTenantContext(this.prisma, context.tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        return { status: 'FAILED', raw: { reason: 'organization_not_found', organizationId }, verified: false };
      }

      const membership = await tx.organizationMembership.findUnique({
        where: { organizationId_personSubjectId: { organizationId, personSubjectId: context.subjectId } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        return {
          status: 'NEEDS_REVIEW',
          raw: { reason: 'membership_not_confirmed', organizationId },
          verified: true,
        };
      }

      // Strongest-first, same ORDER BY level DESC convention as
      // apps/api's badge ranking (VerificationLevel's declared ascending
      // order makes DESC = strongest).
      const verifiedCase = await tx.verificationCase.findFirst({
        where: { subjectId: organization.subjectId, status: 'APPROVED', claimType: 'IDENTITY' },
        orderBy: { level: 'desc' },
      });
      if (!verifiedCase) {
        return {
          status: 'NEEDS_REVIEW',
          raw: { reason: 'organization_not_yet_verified', organizationId },
          verified: true,
        };
      }

      return {
        status: 'PASSED',
        raw: {
          organizationId,
          inheritedFromCaseId: verifiedCase.id,
          inheritedLevel: verifiedCase.level,
          role: membership.role,
        },
        verified: true,
      };
    });
  }
}
