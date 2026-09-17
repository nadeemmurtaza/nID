import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateSessionToken } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { TemporalClientService } from '../../core/temporal/temporal-client.service';
import { loadEnv } from '../../core/config/env';
import type { CreateVerificationCaseDto } from './dto/create-verification-case.dto';

@Injectable()
export class VerificationCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly temporal: TemporalClientService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateVerificationCaseDto) {
    const created = await this.prisma.forTenant(tenantId, async (tx) => {
      const policy = await tx.verificationPolicy.findUnique({
        where: { tenantId_name: { tenantId, name: dto.policyName } },
      });
      if (!policy) {
        throw new NotFoundException(`No policy named "${dto.policyName}" for this tenant.`);
      }
      if (policy.methods.length !== 1 || policy.methods[0] !== 'otp_sms') {
        // Phase 0 has exactly one provider wired up — see the DTO's comment.
        throw new BadRequestException('Phase 0 only supports single-method "otp_sms" policies.');
      }

      const subject = await tx.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }

      const kase = await tx.verificationCase.create({
        data: { tenantId, subjectId: subject.id, policyId: policy.id, status: 'PENDING' },
      });
      await tx.verificationMethodAttempt.create({
        data: { tenantId, caseId: kase.id, method: 'otp_sms', providerKey: 'otp_sms', status: 'PENDING' },
      });

      const workflowId = `otp-${kase.id}`;
      const updated = await tx.verificationCase.update({
        where: { id: kase.id },
        data: { temporalWorkflowId: workflowId },
      });

      // A subject-facing credential for this one case — apps/verify-ui
      // authenticates with this, never with the tenant's own API key. See
      // VerificationSession's schema comment.
      const env = loadEnv();
      const session = generateSessionToken();
      await tx.verificationSession.create({
        data: {
          tenantId,
          caseId: kase.id,
          tokenHash: session.hash,
          expiresAt: new Date(Date.now() + env.sessionTtlMinutes * 60_000),
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'verification_case.create',
        subjectId: subject.id,
        caseId: kase.id,
      });

      return {
        case: updated,
        subjectId: subject.id,
        workflowId,
        sessionToken: session.plaintext,
        hostedUrl: `${env.verifyUiUrl}/session/${session.plaintext}`,
      };
    });

    // Starting the Temporal workflow happens after the DB transaction
    // commits: Temporal is an external system the transaction can't roll
    // back, so it must not be inside it. If this throws, the case is left
    // PENDING with a temporalWorkflowId bound to a workflow that never
    // started — a visible, queryable failure mode, not a silently retried one.
    await this.temporal.startOtpVerification(created.workflowId, {
      caseId: created.case.id,
      tenantId,
      subjectId: created.subjectId,
      phone: dto.phone,
    });

    return {
      ...created.case,
      sessionToken: created.sessionToken,
      hostedUrl: created.hostedUrl,
    };
  }

  /** The dashboard's case list — most recent first. */
  async list(tenantId: string, apiKeyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cases = await tx.verificationCase.findMany({
        orderBy: { createdAt: 'desc' },
        include: { subject: true },
        take: 100,
      });
      // One audit entry for the list action itself, not per-row — the
      // per-row PII disclosure a list already minimizes (no
      // nationalIdNumber, no attempts) doesn't warrant N audit writes for
      // one dashboard page load.
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'verification_case.list',
      });
      return cases;
    });
  }

  async getById(tenantId: string, apiKeyId: string, caseId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const kase = await tx.verificationCase.findUnique({
        where: { id: caseId },
        include: { attempts: true, subject: true },
      });
      if (!kase) {
        throw new NotFoundException('Verification case not found.');
      }
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'verification_case.read',
        subjectId: kase.subjectId,
        caseId: kase.id,
      });
      return kase;
    });
  }

  async submitOtpCode(tenantId: string, apiKeyId: string, caseId: string, code: string): Promise<{ accepted: true }> {
    const kase = await this.prisma.forTenant(tenantId, async (tx) => {
      const found = await tx.verificationCase.findUnique({ where: { id: caseId } });
      if (!found || !found.temporalWorkflowId) {
        throw new NotFoundException('Verification case not found.');
      }
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'verification_case.submit_otp',
        subjectId: found.subjectId,
        caseId: found.id,
      });
      return found;
    });

    await this.temporal.submitOtpCode(kase.temporalWorkflowId as string, code);
    return { accepted: true };
  }
}
