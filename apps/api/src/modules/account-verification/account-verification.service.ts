import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Account } from '@nid/db';
import { cnicPhoneLinkedMethods } from '@nid/verification-providers';
import { PrismaService } from '../../core/db/prisma.service';
import { CrossTenantBadgesService } from '../badges/cross-tenant-badges.service';
import type { Badge } from '../badges/badge-ranking';
import { VerificationCasesService } from '../verification-cases/verification-cases.service';
import type { CreateSelfVerificationCaseDto } from './dto/create-self-verification-case.dto';

/**
 * The one tenant self-service verification (this module) runs cases
 * against — every other Tenant row represents an nID customer verifying
 * ITS end-users; this one is nID verifying its own Account holders
 * directly. Given a fixed id (not the usual cuid() default) by
 * packages/db/prisma/seed.ts's seedPlatformTenant, specifically so it can
 * be referenced here without a runtime lookup — Tenant itself carries RLS
 * (the "tenant_self" policy), so nid_app can't SELECT a Tenant row without
 * already knowing its id to scope app.tenant_id to. This constant is the
 * one place that id is allowed to live outside the seed script.
 */
export const PLATFORM_TENANT_ID = 'nid-platform';

export interface AccountVerificationStatus {
  /** Claim-level badges (IDENTITY/DATE_OF_BIRTH/EDUCATION/EMPLOYMENT), same cross-tenant evidence the public profile's badges row reads. */
  badges: Badge[];
  realName: { value: string; verifiedAt: Date; cnicPhoneLinked: boolean } | null;
  /** True if ANY PhoneNameEvidence row (not just the latest) came from a method proving NATIONAL_ID_NUMBER+PHONE together — the specific fact profiles.service.ts's username gate requires. */
  cnicPhoneLinked: boolean;
  /** Mirrors requireVerifiedRealName()'s own bar exactly — an IDENTITY badge AND cnicPhoneLinked. */
  usernameEligible: boolean;
  email: { address: string | null; verifiedAt: Date | null };
}

/**
 * The backend for apps/profile-ui's Verification Center — read-only status
 * (getStatus) plus self-service case initiation (createCase/listCases/
 * getCase) against the platform tenant above. Deliberately thin on the
 * case-creation side: it reuses VerificationCasesService.create() wholesale
 * rather than forking the policy/Subject-type/multi-method logic that
 * already lives there, and reuses apps/verify-ui entirely for the actual
 * document-upload/liveness-capture/OTP UI via the hostedUrl that call
 * already returns — this service's only real job is resolving "which
 * Subject, in which tenant, does this Account's case belong to."
 */
@Injectable()
export class AccountVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badges: CrossTenantBadgesService,
    private readonly cases: VerificationCasesService,
  ) {}

  async getStatus(account: Account): Promise<AccountVerificationStatus> {
    const badges = await this.badges.getBadgesForPhone(account.phone);
    const hasIdentityBadge = badges.some((badge) => badge.claimType === 'IDENTITY');
    const qualifyingMethods = cnicPhoneLinkedMethods();

    const latestName = await this.prisma.unscoped.phoneNameEvidence.findFirst({
      where: { phone: account.phone },
      orderBy: { verifiedAt: 'desc' },
    });
    // Any row proving the CNIC+phone link counts for eligibility, even if
    // a LATER, weaker row (e.g. a fresh document_ocr scan) is now the most
    // recent one — same "any qualifying row, not just the latest" logic
    // requireVerifiedRealName() applies.
    const cnicPhoneLinked =
      (await this.prisma.unscoped.phoneNameEvidence.findFirst({
        where: { phone: account.phone, method: { in: qualifyingMethods } },
      })) !== null;

    return {
      badges,
      realName: latestName
        ? {
            value: `${latestName.givenName} ${latestName.familyName}`,
            verifiedAt: latestName.verifiedAt,
            cnicPhoneLinked: qualifyingMethods.includes(latestName.method),
          }
        : null,
      cnicPhoneLinked,
      usernameEligible: hasIdentityBadge && cnicPhoneLinked,
      email: { address: account.email, verifiedAt: account.emailVerifiedAt },
    };
  }

  /**
   * Creates (or reuses) this Account's own Subject in the platform tenant,
   * then delegates to VerificationCasesService.create() exactly the way a
   * tenant's own API-key-authenticated call does — same policy/method-type
   * validation, same VerificationSession + hostedUrl, same Temporal
   * workflow start. The only difference is the actor recorded in the audit
   * trail (ACCOUNT, not API_KEY) and that the Subject/policy are resolved
   * here instead of being caller-supplied.
   */
  async createCase(account: Account, dto: CreateSelfVerificationCaseDto) {
    if (dto.policyName === 'cnic-phone-link' && !dto.referenceId) {
      throw new BadRequestException('referenceId (your CNIC) is required for the cnic-phone-link check.');
    }

    const subjectId = await this.prisma.forTenant(PLATFORM_TENANT_ID, async (tx) => {
      const existing = await tx.subject.findFirst({ where: { accountId: account.id } });
      if (existing) {
        return existing.id;
      }
      const created = await tx.subject.create({
        data: { tenantId: PLATFORM_TENANT_ID, type: 'PERSON', phone: account.phone, accountId: account.id },
      });
      return created.id;
    });

    return this.cases.create(
      PLATFORM_TENANT_ID,
      { type: 'ACCOUNT', id: account.id },
      { subjectId, policyName: dto.policyName, phone: account.phone, referenceId: dto.referenceId },
    );
  }

  /** `policy: { select: { name: true } }` so the caller can tell an 'identity' case from a 'cnic-phone-link' one without inferring it from which methods happen to be attached. */
  async listCases(account: Account) {
    return this.prisma.forTenant(PLATFORM_TENANT_ID, (tx) =>
      tx.verificationCase.findMany({
        where: { subject: { accountId: account.id } },
        orderBy: { createdAt: 'desc' },
        include: { attempts: { orderBy: { startedAt: 'asc' } }, policy: { select: { name: true } } },
      }),
    );
  }

  async getCase(account: Account, caseId: string) {
    const kase = await this.prisma.forTenant(PLATFORM_TENANT_ID, (tx) =>
      tx.verificationCase.findUnique({
        where: { id: caseId },
        include: { attempts: { orderBy: { startedAt: 'asc' } }, subject: true, policy: { select: { name: true } } },
      }),
    );
    if (!kase || kase.subject.accountId !== account.id) {
      throw new NotFoundException('No such verification case.');
    }
    return kase;
  }
}
