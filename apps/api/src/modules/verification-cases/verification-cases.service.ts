import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateSessionToken } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { TemporalClientService } from '../../core/temporal/temporal-client.service';
import { StorageService } from '../../core/storage/storage.service';
import { loadEnv } from '../../core/config/env';
import type { CreateVerificationCaseDto } from './dto/create-verification-case.dto';

export interface UploadedMethodFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/** Methods reachable through the generic .../claims/:method/submit routes — see submitClaimDocument(). */
const CLAIM_DOCUMENT_METHODS = new Set(['dob_document', 'education_document', 'employment_document']);
/** Methods that resolve synchronously in RegistryCheckProvider.start() and need a `referenceId` at creation. */
const REGISTRY_CHECK_METHODS = new Set(['education_registry', 'employment_registry']);

@Injectable()
export class VerificationCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly temporal: TemporalClientService,
    private readonly storage: StorageService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateVerificationCaseDto) {
    const created = await this.prisma.forTenant(tenantId, async (tx) => {
      const policy = await tx.verificationPolicy.findUnique({
        where: { tenantId_name: { tenantId, name: dto.policyName } },
      });
      if (!policy) {
        throw new NotFoundException(`No policy named "${dto.policyName}" for this tenant.`);
      }
      if (policy.methods.length === 0) {
        throw new BadRequestException(`Policy "${dto.policyName}" has no methods configured.`);
      }
      if (policy.methods.includes('otp_sms') && !dto.phone) {
        throw new BadRequestException('This policy includes otp_sms, which requires "phone".');
      }

      const subject = await tx.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }

      const kase = await tx.verificationCase.create({
        data: {
          tenantId,
          subjectId: subject.id,
          policyId: policy.id,
          status: 'PENDING',
          // Denormalized from the policy so the badges endpoint can find a
          // Subject's strongest passed case per ClaimType without a join —
          // see schema.prisma's comment on these two columns.
          claimType: policy.claimType,
          level: policy.level,
        },
      });
      for (const method of policy.methods) {
        await tx.verificationMethodAttempt.create({
          data: { tenantId, caseId: kase.id, method, providerKey: method, status: 'PENDING' },
        });
      }

      const workflowId = `verification-${kase.id}`;
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
        methods: policy.methods,
        sessionToken: session.plaintext,
        hostedUrl: `${env.verifyUiUrl}/session/${session.plaintext}`,
      };
    });

    // Starting the Temporal workflow happens after the DB transaction
    // commits: Temporal is an external system the transaction can't roll
    // back, so it must not be inside it. If this throws, the case is left
    // PENDING with a temporalWorkflowId bound to a workflow that never
    // started — a visible, queryable failure mode, not a silently retried one.
    await this.temporal.startVerification(created.workflowId, {
      caseId: created.case.id,
      tenantId,
      subjectId: created.subjectId,
      methods: created.methods,
      methodInput: buildMethodInput(created.methods, dto),
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
        // Postgres has no implicit row order — see sessions.service.ts's
        // getStatus() for why this must be explicit.
        include: { attempts: { orderBy: { startedAt: 'asc' } }, subject: true },
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
    return this.submitMethod(tenantId, apiKeyId, caseId, 'otp_sms', 'verification_case.submit_otp', {
      submittedCode: code,
    });
  }

  async submitDocument(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    file: UploadedMethodFile,
  ): Promise<{ accepted: true }> {
    return this.submitUploadedMethod(
      tenantId,
      apiKeyId,
      caseId,
      'document_ocr',
      'verification_case.submit_document',
      file,
    );
  }

  async submitLiveness(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    file: UploadedMethodFile,
  ): Promise<{ accepted: true }> {
    return this.submitUploadedMethod(tenantId, apiKeyId, caseId, 'liveness', 'verification_case.submit_liveness', file);
  }

  /**
   * dob_document / education_document / employment_document — the same
   * upload mechanism as submitDocument/submitLiveness, generalized to one
   * route+method instead of three near-identical ones, since these three
   * only differ by which claim they're proving (docs/HOUSE-RULES.md rule 1
   * applies to routes the same way it applies to providers).
   */
  async submitClaimDocument(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    file: UploadedMethodFile,
  ): Promise<{ accepted: true }> {
    if (!CLAIM_DOCUMENT_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a claim-document method.`);
    }
    return this.submitUploadedMethod(tenantId, apiKeyId, caseId, method, 'verification_case.submit_claim_document', file);
  }

  /** Shared by every "the subject submitted something for the method the case is currently waiting on" path. */
  private async submitMethod(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{ accepted: true }> {
    const kase = await this.prisma.forTenant(tenantId, async (tx) => {
      const found = await tx.verificationCase.findUnique({ where: { id: caseId } });
      if (!found || !found.temporalWorkflowId) {
        throw new NotFoundException('Verification case not found.');
      }
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
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
   * raw bytes, which would bloat Temporal's workflow history. See
   * @nid/storage's header comment and verification.workflow.ts's contract.
   */
  private async submitUploadedMethod(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    action: string,
    file: UploadedMethodFile,
  ): Promise<{ accepted: true }> {
    const { kase, storageKey, contentType } = await this.prisma.forTenant(tenantId, async (tx) => {
      const found = await tx.verificationCase.findUnique({ where: { id: caseId } });
      if (!found || !found.temporalWorkflowId) {
        throw new NotFoundException('Verification case not found.');
      }
      const attempt = await tx.verificationMethodAttempt.findFirst({ where: { caseId, method } });
      if (!attempt) {
        throw new BadRequestException(`This case's policy does not include "${method}".`);
      }

      const stored = await this.storage.put({
        tenantId,
        methodAttemptId: attempt.id,
        filename: file.filename,
        contentType: file.contentType,
        body: file.buffer,
      });
      await tx.documentAsset.create({
        data: {
          tenantId,
          methodAttemptId: attempt.id,
          storageKey: stored.key,
          contentType: stored.contentType,
          sizeBytes: stored.size,
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
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

/**
 * Builds VerificationWorkflowInput.methodInput — the only two methods that
 * need anything at case-creation time: otp_sms (a phone to send the code
 * to) and the two registry-check methods (a referenceId to look up, since
 * RegistryCheckProvider resolves synchronously with nothing for the
 * subject to upload). Everything else needs no entry.
 */
function buildMethodInput(
  methods: string[],
  dto: CreateVerificationCaseDto,
): Record<string, Record<string, unknown>> {
  const methodInput: Record<string, Record<string, unknown>> = {};
  if (methods.includes('otp_sms')) {
    methodInput['otp_sms'] = { phone: dto.phone };
  }
  for (const method of methods) {
    if (REGISTRY_CHECK_METHODS.has(method)) {
      methodInput[method] = { referenceId: dto.referenceId };
    }
  }
  return methodInput;
}
