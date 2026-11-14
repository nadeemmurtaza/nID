import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateSessionToken } from '@nid/shared-types';
import { methodTimeout, subjectTypesAllowedFor } from '@nid/verification-providers';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { TemporalClientService } from '../../core/temporal/temporal-client.service';
import { StorageService } from '../../core/storage/storage.service';
import { loadEnv } from '../../core/config/env';
import type { CreateVerificationCaseDto } from './dto/create-verification-case.dto';
import type { ActorType, CaseCreationActor } from '../../core/auth/types';

export interface UploadedMethodFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/** Methods reachable through the generic .../claims/:method/submit routes — see submitClaimDocument(). */
const CLAIM_DOCUMENT_METHODS = new Set([
  'dob_document',
  'education_document',
  'employment_document',
  'address_utility_bill',
  'business_registration_document',
]);
/** Methods that resolve synchronously in RegistryCheckProvider.start() and need a `referenceId` at creation. */
const REGISTRY_CHECK_METHODS = new Set([
  'education_registry',
  'employment_registry',
  'bank_account_title',
  'estamp_registry',
  'business_registry',
]);
/** Methods reachable through the generic .../claims/:method/report route — see submitSelfReport(). */
const SELF_REPORT_METHODS = new Set(['ecp_voter_registration']);
/** Methods reachable through the generic .../claims/:method/agent-attest route — see submitAgentAttestation(). */
const AGENT_ATTESTED_METHODS = new Set(['agent_in_person_document']);
/** Methods that resolve synchronously in OrganizationMembershipProvider.start() and need an `organizationId` at creation. */
const ORG_MEMBERSHIP_METHODS = new Set(['org_membership']);
/** Methods reachable through the generic .../claims/:method/code route — see submitCode(). otp_sms keeps its own dedicated /otp/submit route (established, still used). */
const CODE_SUBMISSION_METHODS = new Set(['address_postal_otp']);
/** Methods reachable through the generic .../claims/:method/location route — see submitLocation(). */
const LOCATION_METHODS = new Set(['address_gps_match']);

@Injectable()
export class VerificationCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly temporal: TemporalClientService,
    private readonly storage: StorageService,
  ) {}

  async create(tenantId: string, actor: CaseCreationActor, dto: CreateVerificationCaseDto) {
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
      for (const method of policy.methods) {
        const allowedTypes = subjectTypesAllowedFor(method);
        if (!allowedTypes.includes(subject.type)) {
          throw new BadRequestException(
            `Policy "${dto.policyName}" includes "${method}", which only applies to a ` +
              `${allowedTypes.join('/')} subject, not ${subject.type}.`,
          );
        }
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
        actorType: actor.type,
        actorId: actor.id,
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
      methodTimeouts: Object.fromEntries(created.methods.map((method) => [method, methodTimeout(method)])),
    });

    return {
      ...created.case,
      sessionToken: created.sessionToken,
      hostedUrl: created.hostedUrl,
    };
  }

  /** The dashboard's case list — most recent first. Reachable by a tenant API key or a real staff Account session — see TenantActorGuard. */
  async list(tenantId: string, actorType: ActorType, actorId: string) {
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
        actorType,
        actorId,
        action: 'verification_case.list',
      });
      return cases;
    });
  }

  async getById(tenantId: string, actorType: ActorType, actorId: string, caseId: string) {
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
        actorType,
        actorId,
        action: 'verification_case.read',
        subjectId: kase.subjectId,
        caseId: kase.id,
      });
      return kase;
    });
  }

  /**
   * The manual-review queue's one action: a human decision on a case the
   * automated pipeline correctly stopped at NEEDS_REVIEW rather than
   * guessing (verification.workflow.ts's `resolveCaseActivity` call for
   * that status is the case's terminal write — there is no live workflow
   * left to signal, so this is a direct status transition, not a Temporal
   * signal). Only reachable from NEEDS_REVIEW: an already-resolved case
   * (however it got there) is not this endpoint's to relitigate.
   */
  async resolveCase(
    tenantId: string,
    actorType: ActorType,
    actorId: string,
    caseId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const kase = await tx.verificationCase.findUnique({ where: { id: caseId } });
      if (!kase) {
        throw new NotFoundException('Verification case not found.');
      }
      if (kase.status !== 'NEEDS_REVIEW') {
        throw new BadRequestException(`Only a case in NEEDS_REVIEW can be manually resolved (this one is ${kase.status}).`);
      }

      const updated = await tx.verificationCase.update({
        where: { id: caseId },
        data: {
          status: decision,
          decision: reason,
          // Whichever real actor made this call — a tenant API key
          // (server-to-server) or a real TenantStaffMembership-backed
          // Account (a human in apps/dashboard) — see TenantActorGuard.
          reviewerId: actorId,
          resolvedAt: new Date(),
        },
      });

      await this.audit.record(tx, tenantId, {
        actorType,
        actorId,
        action: 'verification_case.resolve_manual',
        subjectId: kase.subjectId,
        caseId: kase.id,
      });

      return updated;
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

  /**
   * liveness needs a short BURST of frames, not one file — real blink
   * detection (@nid/liveness-engine) has nothing to detect a blink from in
   * a single photo — plus, when available, a reference photo to face-match
   * against: the same case's document_ocr attempt's own uploaded
   * DocumentAsset (its most recent one, if it uploaded more than once).
   * Liveness never requires document_ocr to have run first or at all; when
   * no reference is found, referenceStorageKey stays undefined and
   * LivenessProvider simply skips the face-match step rather than failing
   * — see evaluateLiveness()'s own contract.
   */
  async submitLiveness(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    frames: UploadedMethodFile[],
  ): Promise<{ accepted: true }> {
    const { kase, storageKeys, referenceStorageKey, contentType } = await this.prisma.forTenant(
      tenantId,
      async (tx) => {
        const found = await tx.verificationCase.findUnique({ where: { id: caseId } });
        if (!found || !found.temporalWorkflowId) {
          throw new NotFoundException('Verification case not found.');
        }
        const attempt = await tx.verificationMethodAttempt.findFirst({ where: { caseId, method: 'liveness' } });
        if (!attempt) {
          throw new BadRequestException('This case\'s policy does not include "liveness".');
        }

        const storageKeys: string[] = [];
        for (const file of frames) {
          const stored = await this.storage.put({
            namespace: tenantId,
            groupId: attempt.id,
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
          storageKeys.push(stored.key);
        }

        const documentAttempt = await tx.verificationMethodAttempt.findFirst({
          where: { caseId, method: 'document_ocr' },
        });
        const referenceAsset = documentAttempt
          ? await tx.documentAsset.findFirst({
              where: { methodAttemptId: documentAttempt.id },
              orderBy: { createdAt: 'desc' },
            })
          : null;

        await this.audit.record(tx, tenantId, {
          actorType: 'API_KEY',
          actorId: apiKeyId,
          action: 'verification_case.submit_liveness',
          subjectId: found.subjectId,
          caseId: found.id,
        });

        return {
          kase: found,
          storageKeys,
          referenceStorageKey: referenceAsset?.storageKey,
          contentType: frames[0]!.contentType,
        };
      },
    );

    await this.temporal.submitMethodPayload(kase.temporalWorkflowId as string, 'liveness', {
      storageKeys,
      referenceStorageKey,
      contentType,
    });
    return { accepted: true };
  }

  /**
   * dob_document / education_document / employment_document — the same
   * single-file upload mechanism as submitDocument (liveness's own
   * submitLiveness now needs a multi-frame variant of its own, above),
   * generalized to one route+method instead of three near-identical ones,
   * since these three
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

  /**
   * ecp_voter_registration — a subject's typed-in report of what a
   * government SMS shortcode told them, never a file. Same generic
   * text-payload signal mechanism otp_sms already uses
   * (submitMethod()), not the upload path — see
   * SelfReportedCheckProvider's header comment for why this method can
   * never auto-resolve.
   */
  async submitSelfReport(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    reportedValue: string,
  ): Promise<{ accepted: true }> {
    if (!SELF_REPORT_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a self-report method.`);
    }
    return this.submitMethod(tenantId, apiKeyId, caseId, method, 'verification_case.submit_self_report', {
      reportedValue,
    });
  }

  /**
   * agent_in_person_document — an authorized tenant agent's direct
   * attestation after physically inspecting the subject's original
   * documents. `agentId` is this same apiKeyId, carried into the payload
   * so AgentAttestedCheckProvider's result is always traceable to a real
   * tenant actor (see its header comment) — never the subject's own
   * session, which is why this route requires ApiKeyGuard rather than
   * apps/verify-ui's subject-facing session token.
   */
  async submitAgentAttestation(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    decision: 'PASSED' | 'FAILED',
    notes: string | undefined,
  ): Promise<{ accepted: true }> {
    if (!AGENT_ATTESTED_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not an agent-attested method.`);
    }
    return this.submitMethod(tenantId, apiKeyId, caseId, method, 'verification_case.submit_agent_attestation', {
      decision,
      notes,
      agentId: apiKeyId,
    });
  }

  /**
   * address_postal_otp — the code a real physical letter carried, typed
   * back. Same inline-value signal mechanism otp_sms already uses
   * (submitMethod()); AddressPostalOtpProvider.handleCallback() does the
   * actual hash comparison.
   */
  async submitCode(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    code: string,
  ): Promise<{ accepted: true }> {
    if (!CODE_SUBMISSION_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a code-submission method.`);
    }
    return this.submitMethod(tenantId, apiKeyId, caseId, method, 'verification_case.submit_code', {
      submittedCode: code,
    });
  }

  /**
   * address_gps_match — the subject's device-reported current location.
   * AddressGpsMatchProvider.handleCallback() compares it against the
   * claimed address's coordinates it already persisted as resultMeta in
   * start().
   */
  async submitLocation(
    tenantId: string,
    apiKeyId: string,
    caseId: string,
    method: string,
    latitude: number,
    longitude: number,
  ): Promise<{ accepted: true }> {
    if (!LOCATION_METHODS.has(method)) {
      throw new BadRequestException(`"${method}" is not a location method.`);
    }
    return this.submitMethod(tenantId, apiKeyId, caseId, method, 'verification_case.submit_location', {
      latitude,
      longitude,
    });
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
        namespace: tenantId,
        groupId: attempt.id,
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
 * Builds VerificationWorkflowInput.methodInput — the only methods that need
 * anything at case-creation time: otp_sms (a phone to send the code to)
 * and the registry-check methods (a referenceId to look up, since
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
      if (method === 'bank_account_title') {
        methodInput[method] = { referenceId: dto.referenceId, accountTitle: dto.accountTitle };
      } else if (method === 'estamp_registry') {
        // referenceId is the CNIC; phone is the number claimed to be
        // linked to it — the same field otp_sms uses, just consumed
        // differently (see CreateVerificationCaseDto's own comment).
        methodInput[method] = { referenceId: dto.referenceId, phone: dto.phone };
      } else {
        methodInput[method] = { referenceId: dto.referenceId };
      }
    }
    if (ORG_MEMBERSHIP_METHODS.has(method)) {
      methodInput[method] = { organizationId: dto.organizationId };
    }
  }
  return methodInput;
}
