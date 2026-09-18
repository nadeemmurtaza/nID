import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Organization, OrganizationMembership } from '@nid/db';
import type { TenantScopedClient } from '../../core/db/prisma.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { AddMemberDto } from './dto/add-member.dto';
import type { InviteEmployeeDto } from './dto/invite-employee.dto';

export interface OrganizationVerificationStatus {
  isVerified: boolean;
  verifiedLevel: string | null;
  verifiedCaseId: string | null;
  verifiedAt: Date | null;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateOrganizationDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.create({
        data: { tenantId, type: 'ORGANIZATION', givenName: dto.legalName },
      });
      const organization = await tx.organization.create({
        data: {
          tenantId,
          subjectId: subject.id,
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          countryCode: dto.countryCode,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.create',
        subjectId: subject.id,
      });

      return organization;
    });
  }

  /**
   * "Verified" here means exactly what org_membership's provider checks:
   * at least one APPROVED VerificationCase for this Organization's own
   * Subject, claimType IDENTITY — real KYB, not an assumption from the row
   * merely existing. Strongest-first, same ORDER BY level DESC convention
   * badge-ranking.ts already documents. The one place this derivation is
   * computed — getById() and ProfilesService.createForOrganization()'s
   * verification gate both call this rather than re-querying.
   */
  private async findVerificationStatus(
    tx: TenantScopedClient,
    subjectId: string,
  ): Promise<OrganizationVerificationStatus> {
    const verifiedCase = await tx.verificationCase.findFirst({
      where: { subjectId, status: 'APPROVED', claimType: 'IDENTITY' },
      orderBy: { level: 'desc' },
      select: { id: true, level: true, resolvedAt: true },
    });

    return {
      isVerified: verifiedCase !== null,
      verifiedLevel: verifiedCase?.level ?? null,
      verifiedCaseId: verifiedCase?.id ?? null,
      verifiedAt: verifiedCase?.resolvedAt ?? null,
    };
  }

  /** Same derivation as getById(), for a caller (ProfilesService) that only needs the verification status itself. */
  async getVerificationStatus(tenantId: string, organizationId: string): Promise<OrganizationVerificationStatus> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      return this.findVerificationStatus(tx, organization.subjectId);
    });
  }

  /**
   * The Organization row itself, but only once it's real-KYB-verified —
   * ProfilesService.createForOrganization() needs the actual row (for
   * legalName, the one name this Organization's own KYB vouches for — see
   * its own comment), not just a boolean, and must never let an
   * unverified Organization's profile-creation attempt get far enough to
   * read legalName in the first place.
   */
  async getVerified(tenantId: string, organizationId: string): Promise<Organization> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      const verification = await this.findVerificationStatus(tx, organization.subjectId);
      if (!verification.isVerified) {
        throw new BadRequestException('This organization must be verified before it can create a brand profile.');
      }
      return organization;
    });
  }

  /**
   * Authorizes a person's own Account to act *for* an Organization —
   * creating/managing its brand Profile (ProfilesService), the only place
   * this is used. Deliberately queries `unscoped`: the caller (a person's
   * own AccountSessionGuard-authenticated request) has no tenant context
   * at all, the same bootstrap shape TenantActorGuard resolves against
   * TenantStaffMembership — OrganizationMembership's own open-SELECT
   * policy (this table's migration) exists for exactly this. Returns the
   * membership row itself, whose `tenantId` is the caller's one legitimate
   * way to discover which tenant this Organization belongs to, without a
   * separate Organization lookup (which has no such bootstrap exception —
   * it carries no PII either, but nothing besides this needs it, so it
   * stays exactly as tenant-scoped as the rest of this schema).
   */
  async requireActiveAdmin(organizationId: string, accountId: string): Promise<OrganizationMembership> {
    const membership = await this.prisma.unscoped.organizationMembership.findFirst({
      where: { organizationId, accountId, status: 'ACTIVE', isAdmin: true },
    });
    if (!membership) {
      throw new ForbiddenException('This account is not an admin of this organization.');
    }
    return membership;
  }

  async getById(tenantId: string, apiKeyId: string, organizationId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }

      const verification = await this.findVerificationStatus(tx, organization.subjectId);

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.read',
        subjectId: organization.subjectId,
      });

      return { ...organization, ...verification };
    });
  }

  /**
   * The attestation act org_membership's provider requires before a member
   * can inherit anything from this Organization's verification — never the
   * subject's own self-declaration (a VerificationCase's organizationId
   * input is only a claim; this row is the proof). Requires the person
   * Subject to already exist in this tenant, same as every other
   * relationship in this schema.
   */
  async addMember(tenantId: string, apiKeyId: string, organizationId: string, dto: AddMemberDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      const person = await tx.subject.findUnique({ where: { id: dto.personSubjectId } });
      if (!person) {
        throw new NotFoundException('Person subject not found.');
      }
      if (person.type !== 'PERSON') {
        throw new BadRequestException('Only a PERSON subject can be a member.');
      }

      const membership = await tx.organizationMembership.upsert({
        where: { organizationId_personSubjectId: { organizationId, personSubjectId: dto.personSubjectId } },
        update: { role: dto.role },
        create: {
          tenantId,
          organizationId,
          personSubjectId: dto.personSubjectId,
          role: dto.role,
          addedByApiKeyId: apiKeyId,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.add_member',
        subjectId: dto.personSubjectId,
      });

      return membership;
    });
  }

  /**
   * "This organization can create nID accounts for employees who don't
   * have one previously" — but account control never moves off the
   * person: this only ever pre-provisions a shell Account (phone set,
   * phoneVerifiedAt left null) and a PENDING OrganizationMembership. The
   * shell claims itself for real the moment the invited phone completes
   * its own real OTP through the normal accounts.service.ts flow — zero
   * new code needed there, since AccountsService.verifyOtp() already
   * upserts on phone. Only the person, from their own session, can accept
   * or decline (accounts.controller.ts's organization-invites routes) —
   * this method only ever leaves a row at PENDING, never ACTIVE.
   */
  async invite(tenantId: string, apiKeyId: string, organizationId: string, dto: InviteEmployeeDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }

      let subject = await tx.subject.findFirst({ where: { tenantId, type: 'PERSON', phone: dto.phone } });
      if (!subject) {
        subject = await tx.subject.create({ data: { tenantId, type: 'PERSON', phone: dto.phone } });
      }

      // Pre-provisioned, not activated — see this method's own header
      // comment. Never sets phoneVerifiedAt; only the person's own OTP does.
      let account = await tx.account.findUnique({ where: { phone: dto.phone } });
      if (!account) {
        account = await tx.account.create({ data: { phone: dto.phone } });
      }
      if (subject.accountId !== account.id) {
        subject = await tx.subject.update({ where: { id: subject.id }, data: { accountId: account.id } });
      }

      const membership = await tx.organizationMembership.upsert({
        where: { organizationId_personSubjectId: { organizationId, personSubjectId: subject.id } },
        // A repeat invite only ever touches role/isAdmin — never resets an
        // already-ACTIVE acceptance or a DECLINED refusal back to PENDING
        // (see MembershipStatus's own schema comment).
        update: { role: dto.role, isAdmin: dto.isAdmin ?? false },
        create: {
          tenantId,
          organizationId,
          personSubjectId: subject.id,
          accountId: account.id,
          role: dto.role,
          isAdmin: dto.isAdmin ?? false,
          status: 'PENDING',
          addedByApiKeyId: apiKeyId,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.invite',
        subjectId: subject.id,
      });

      return membership;
    });
  }

  async listMembers(tenantId: string, apiKeyId: string, organizationId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new NotFoundException('Organization not found.');
      }
      const members = await tx.organizationMembership.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'organization.members_list',
      });

      return members;
    });
  }

  /**
   * An account's own view of what's been invited to it — never anything
   * about ANOTHER account's memberships, and never surfaces which OTHER
   * organizations this account belongs to when read from a given org's
   * side (nothing here reads that way; every query is `accountId`-scoped
   * to the caller, the same "person is in control of who sees what"
   * boundary as everywhere else in this feature). Deliberately `unscoped`
   * — see OrganizationMembership's open-SELECT policy — this is a
   * cross-tenant read by design, and PENDING-only: an account has no
   * reason to be told about its own already-ACTIVE/DECLINED history here
   * (GET .../:id/members, tenant-side, is the record of that).
   */
  async listMyInvites(accountId: string) {
    return this.prisma.unscoped.organizationMembership.findMany({
      where: { accountId, status: 'PENDING' },
      include: { organization: { select: { id: true, legalName: true, countryCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Accept or decline an invite addressed to THIS account — the one place
   * a PENDING row ever moves. Looked up unscoped first (bootstrap, same
   * reasoning as listMyInvites), which also discovers the tenantId needed
   * to perform the actual write inside its real tenant-scoped RLS context
   * — the same "bootstrap read, then scoped write" shape
   * TenantActorGuard's own lookup already establishes elsewhere. A
   * mismatched accountId (someone else's invite) and a genuinely missing
   * id get the identical NotFoundException — never distinguishable, so
   * this can't be used to probe whether an id exists.
   */
  async respondToInvite(
    accountId: string,
    membershipId: string,
    decision: 'ACCEPTED' | 'DECLINED',
  ): Promise<OrganizationMembership> {
    const membership = await this.prisma.unscoped.organizationMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.accountId !== accountId) {
      throw new NotFoundException('No pending invite with that id for this account.');
    }
    if (membership.status !== 'PENDING') {
      throw new BadRequestException(`This invite was already ${membership.status.toLowerCase()}.`);
    }

    return this.prisma.forTenant(membership.tenantId, (tx) =>
      tx.organizationMembership.update({
        where: { id: membershipId },
        data: { status: decision === 'ACCEPTED' ? 'ACTIVE' : 'DECLINED', respondedAt: new Date() },
      }),
    );
  }
}
