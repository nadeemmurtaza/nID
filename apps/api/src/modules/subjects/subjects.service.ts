import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  pickStrongestPerClaimType,
  pickStrongestPerAttribute,
  type RankableEvidence,
  type RankableAttributeEvidence,
} from '../badges/badge-ranking';
import type { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateSubjectDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.create({
        data: {
          tenantId,
          type: dto.type,
          externalRef: dto.externalRef,
          givenName: dto.givenName,
          familyName: dto.familyName,
          email: dto.email,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          region: dto.region,
          countryCode: dto.countryCode,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });

      // PhoneBadgeEvidence carries no RLS (schema.prisma's comment on it) so
      // it's writable through this same tenant-scoped transaction — a
      // self-attested DATE_OF_BIRTH row only, never overwritten by a
      // stronger APPROVED one written elsewhere by resolveCaseActivity
      // (apps/workflows), since getBadges ranks strongest-first regardless
      // of write order.
      if (subject.phone && subject.dateOfBirth) {
        await tx.phoneBadgeEvidence.create({
          data: {
            phone: subject.phone,
            tenantId,
            subjectId: subject.id,
            claimType: 'DATE_OF_BIRTH',
            level: 'SELF_ATTESTED',
            verifiedAt: null,
          },
        });
      }

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.create',
        subjectId: subject.id,
      });
      return subject;
    });
  }

  async getById(tenantId: string, apiKeyId: string, subjectId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Deliberately no `where: { tenantId }` — RLS is what must stop this
      // from returning another tenant's Subject, per docs/HOUSE-RULES.md rule 2.
      const subject = await tx.subject.findUnique({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.read',
        subjectId: subject.id,
      });
      return subject;
    });
  }

  /**
   * One badge per ClaimType a Subject has ever been checked for — the
   * strongest APPROVED case's level, not the most recent (a passed
   * education_registry check outranks a later, weaker education_document
   * re-check; both prove the same claim, and the stronger proof shouldn't
   * regress just because someone re-ran a cheaper check). ClaimTypes with
   * no passed case at all are simply absent from the list, except
   * DATE_OF_BIRTH: if the Subject has a dateOfBirth on file but no passed
   * case ever verified it, that's shown as SELF_ATTESTED — a value the
   * subject supplied, never independently checked. EDUCATION and
   * EMPLOYMENT have no equivalent scalar field to be self-attested from in
   * this schema, so they're either verified or entirely absent, never
   * fabricated as self-attested.
   */
  async getBadges(tenantId: string, apiKeyId: string, subjectId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.findUnique({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }

      // Postgres orders enum values by declaration order (schema.prisma
      // declares VerificationLevel weakest-to-strongest), so `level: 'desc'`
      // reliably ranks a Subject's cases from strongest proof to weakest.
      const approvedCases = await tx.verificationCase.findMany({
        where: { subjectId, status: 'APPROVED' },
        orderBy: [{ level: 'desc' }, { resolvedAt: 'desc' }],
        select: { id: true, claimType: true, level: true, resolvedAt: true },
      });

      const evidence: RankableEvidence[] = approvedCases.map((kase) => ({
        claimType: kase.claimType,
        level: kase.level,
        verifiedAt: kase.resolvedAt,
        caseId: kase.id,
      }));

      // Appended last: pickStrongestPerClaimType keeps the first row it
      // sees per claimType, so this only wins when no APPROVED
      // DATE_OF_BIRTH case is already in `evidence` above.
      if (subject.dateOfBirth) {
        evidence.push({ claimType: 'DATE_OF_BIRTH', level: 'SELF_ATTESTED', verifiedAt: null, caseId: null });
      }

      const badges = pickStrongestPerClaimType(evidence);

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.badges_read',
        subjectId: subject.id,
      });

      return { subjectId: subject.id, badges };
    });
  }

  /**
   * The fine-grained counterpart to getBadges() above: a "tiny verification
   * badge" per individual real-world fact (NAME, NATIONAL_ID_NUMBER, PHONE,
   * EMAIL, DATE_OF_BIRTH, ADDRESS) rather than one badge per whole-case
   * claimType. Reads apps/workflows' resolveCaseActivity's own
   * VerifiedAttribute writes — see method-attributes.ts for exactly which
   * method proves which attribute(s), and at what level. A Subject with no
   * evidence for a given attribute simply has no entry for it here — never
   * a fabricated SELF_ATTESTED fallback the way DATE_OF_BIRTH gets one in
   * getBadges(), since a bare Subject.addressLine1/email/etc. field being
   * set says nothing about whether it was ever checked.
   */
  async getAttributeBadges(tenantId: string, apiKeyId: string, subjectId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.findUnique({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }

      // Same ORDER BY level DESC convention every other ranking in this
      // codebase relies on — VerificationLevel's ascending declaration
      // order makes DESC = strongest.
      const evidence = await tx.verifiedAttribute.findMany({
        where: { subjectId },
        orderBy: [{ level: 'desc' }, { verifiedAt: 'desc' }],
        select: { attribute: true, level: true, verifiedAt: true, caseId: true, method: true },
      });

      const rankable: RankableAttributeEvidence[] = evidence.map((row) => ({
        attribute: row.attribute,
        level: row.level,
        verifiedAt: row.verifiedAt,
        caseId: row.caseId,
        method: row.method,
      }));

      const badges = pickStrongestPerAttribute(rankable);

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.attribute_badges_read',
        subjectId: subject.id,
      });

      return { subjectId: subject.id, badges };
    });
  }
}
