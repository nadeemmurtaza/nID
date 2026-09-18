import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { sha256Hex } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { TemporalClientService } from '../../core/temporal/temporal-client.service';
import { StorageService } from '../../core/storage/storage.service';

export interface UploadedMethodFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/** Methods reachable through the generic .../claims/:method/submit route — see submitClaimDocument(). */
const CLAIM_DOCUMENT_METHODS = new Set(['dob_document', 'education_document', 'employment_document']);
/** Methods reachable through the generic .../claims/:method/report route — see submitSelfReport(). */
const SELF_REPORT_METHODS = new Set(['ecp_voter_registration']);

/**
 * The subject-facing half of a verification case — resolved by
 * VerificationSession token instead of a tenant API key, exactly the way
 * ApiKeyGuard resolves TenantApiKey before app.tenant_id is set. See
 * VerificationSession's schema comment and the migration's RLS policy.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly temporal: TemporalClientService,
    private readonly storage: StorageService,
  ) {}

  private async resolve(token: string) {
    const tokenHash = sha256Hex(token);
    const session = await this.prisma.unscoped.verificationSession.findUnique({ where: { tokenHash } });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('This verification link is invalid or has expired.');
    }
    return session;
  }

  async getStatus(token: string) {
    const session = await this.resolve(token);

    return this.prisma.forTenant(session.tenantId, async (tx) => {
      const kase = await tx.verificationCase.findUniqueOrThrow({
        where: { id: session.caseId },
        // Postgres has no implicit row order — without this, a policy's
        // methods can come back in a different order than they run in
        // (observed live: an UPDATE on an earlier attempt reshuffled the
        // physical scan order), and apps/verify-ui relies on this order to
        // find the current step.
        include: { attempts: { orderBy: { startedAt: 'asc' } }, subject: { select: { phone: true } } },
      });

      await this.audit.record(tx, session.tenantId, {
        actorType: 'SUBJECT',
        action: 'verification_case.read',
        subjectId: kase.subjectId,
        caseId: kase.id,
      });

      return {
        status: kase.status,
        claimType: kase.claimType,
        // Ordered the way the policy runs them, not DB insertion order —
        // apps/verify-ui walks this list to know which step is next.
        attempts: kase.attempts.map((a) => ({ method: a.method, status: a.status })),
        phone: kase.subject.phone,
      };
    });
  }

  async submitOtp(token: string, code: string): Promise<{ accepted: true }> {
    return this.submitMethod(token, 'otp_sms', 'verification_case.submit_otp', { submittedCode: code });
  }

  async submitDocument(token: string, file: UploadedMethodFile): Promise<{ accepted: true }> {
    return this.submitUploadedMethod(token, 'document_ocr', 'verification_case.submit_document', file);
  }

  async submitLiveness(token: string, file: UploadedMethodFile): Promise<{ accepted: true }> {
    return this.submitUploadedMethod(token, 'liveness', 'verification_case.submit_liveness', file);
  }

  /**
   * dob_document / education_document / employment_document — same upload
   * mechanism as submitDocument/submitLiveness, generalized to one route
   * instead of three near-identical ones (docs/HOUSE-RULES.md rule 1
   * applies to routes the same way it applies to providers).
   */
  async submitClaimDocument(token: string, method: string, file: UploadedMethodFile): Promise<{ accepted: true }> {
    if (!CLAIM_DOCUMENT_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a claim-document method.`);
    }
    return this.submitUploadedMethod(token, method, 'verification_case.submit_claim_document', file);
  }

  /** ecp_voter_registration — see VerificationCasesService.submitSelfReport() / SelfReportedCheckProvider. */
  async submitSelfReport(token: string, method: string, reportedValue: string): Promise<{ accepted: true }> {
    if (!SELF_REPORT_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a self-report method.`);
    }
    return this.submitMethod(token, method, 'verification_case.submit_self_report', { reportedValue });
  }

  private async submitMethod(
    token: string,
    method: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{ accepted: true }> {
    const session = await this.resolve(token);

    const kase = await this.prisma.forTenant(session.tenantId, async (tx) => {
      const found = await tx.verificationCase.findUniqueOrThrow({ where: { id: session.caseId } });
      if (!found.temporalWorkflowId) {
        throw new BadRequestException('This verification is no longer accepting submissions.');
      }
      await this.audit.record(tx, session.tenantId, {
        actorType: 'SUBJECT',
        action,
        subjectId: found.subjectId,
        caseId: found.id,
      });
      return found;
    });

    await this.temporal.submitMethodPayload(kase.temporalWorkflowId as string, method, payload);
    return { accepted: true };
  }

  /**
   * document_ocr / liveness: writes the upload to storage and a DocumentAsset
   * row first, then signals the workflow with a reference to it — never the
   * raw bytes. See @nid/storage's header comment and
   * verification.workflow.ts's contract.
   */
  private async submitUploadedMethod(
    token: string,
    method: string,
    action: string,
    file: UploadedMethodFile,
  ): Promise<{ accepted: true }> {
    const session = await this.resolve(token);

    const { kase, storageKey, contentType } = await this.prisma.forTenant(session.tenantId, async (tx) => {
      const found = await tx.verificationCase.findUniqueOrThrow({ where: { id: session.caseId } });
      if (!found.temporalWorkflowId) {
        throw new BadRequestException('This verification is no longer accepting submissions.');
      }
      const attempt = await tx.verificationMethodAttempt.findFirst({
        where: { caseId: session.caseId, method },
      });
      if (!attempt) {
        throw new BadRequestException(`This case's policy does not include "${method}".`);
      }

      const stored = await this.storage.put({
        namespace: session.tenantId,
        groupId: attempt.id,
        filename: file.filename,
        contentType: file.contentType,
        body: file.buffer,
      });
      await tx.documentAsset.create({
        data: {
          tenantId: session.tenantId,
          methodAttemptId: attempt.id,
          storageKey: stored.key,
          contentType: stored.contentType,
          sizeBytes: stored.size,
        },
      });

      await this.audit.record(tx, session.tenantId, {
        actorType: 'SUBJECT',
        action,
        subjectId: found.subjectId,
        caseId: found.id,
      });

      return { kase: found, storageKey: stored.key, contentType: stored.contentType };
    });

    await this.temporal.submitMethodPayload(kase.temporalWorkflowId as string, method, { storageKey, contentType });
    return { accepted: true };
  }
}
