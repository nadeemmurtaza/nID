import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
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
        },
      });
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

      const badges = new Map<
        string,
        { claimType: string; level: string; verifiedAt: Date | null; caseId: string | null }
      >();
      for (const kase of approvedCases) {
        if (!badges.has(kase.claimType)) {
          badges.set(kase.claimType, {
            claimType: kase.claimType,
            level: kase.level,
            verifiedAt: kase.resolvedAt,
            caseId: kase.id,
          });
        }
      }

      if (!badges.has('DATE_OF_BIRTH') && subject.dateOfBirth) {
        badges.set('DATE_OF_BIRTH', {
          claimType: 'DATE_OF_BIRTH',
          level: 'SELF_ATTESTED',
          verifiedAt: null,
          caseId: null,
        });
      }

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.badges_read',
        subjectId: subject.id,
      });

      return { subjectId: subject.id, badges: Array.from(badges.values()) };
    });
  }
}
