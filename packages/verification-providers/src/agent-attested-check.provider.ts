import type { VerificationMethodProvider, VerificationResult, PendingResult } from './types';

/**
 * Physical, in-person document verification: an authorized tenant agent
 * holds the subject's ORIGINAL documents in hand, inspects them, and
 * attests to what they saw. Unlike SelfReportedCheckProvider (the subject
 * reporting on themselves, which can never be trusted enough to auto-pass),
 * this is first-party evidence from an authenticated tenant actor acting in
 * an official capacity — the same trust level a bank teller or notary's
 * in-person ID check already carries in the physical world. That's why
 * handleCallback() below CAN resolve directly to PASSED/FAILED instead of
 * being forced through NEEDS_REVIEW: the human-judgment step already
 * happened, out of band, before this callback ever fires.
 *
 * The trust boundary is enforced by the caller, not this provider: apps/api
 * only reaches handleCallback() for this method through a tenant
 * API-key-authenticated route (POST .../claims/:method/agent-attest, never
 * the subject-facing session token verify-ui submits through) — see
 * VerificationCasesService.submitAgentAttestation(). `agentId` is that
 * tenant API key's id, carried into `raw` so the decision is always
 * traceable to a real actor, the same accountability
 * VerificationCase.reviewerId already gives the manual-review queue.
 */
export class AgentAttestedCheckProvider implements VerificationMethodProvider {
  constructor(
    readonly key: string,
    readonly label: string,
  ) {}

  async start(): Promise<PendingResult> {
    // Nothing to check until an agent has physically inspected the
    // documents and submitted their attestation.
    return { pending: true };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const decision = payload['decision'];
    const agentId = payload['agentId'];
    const notes = payload['notes'];

    if (typeof agentId !== 'string' || agentId.length === 0) {
      // No accountable actor named — never persist an attestation nobody
      // can be held to.
      return { status: 'FAILED', raw: { reason: 'missing_agent_id' }, verified: false };
    }
    if (decision !== 'PASSED' && decision !== 'FAILED') {
      return { status: 'FAILED', raw: { reason: 'missing_or_invalid_decision', agentId }, verified: false };
    }

    return {
      status: decision,
      raw: {
        agentId,
        notes: typeof notes === 'string' ? notes : null,
        method: 'in_person_document_inspection',
      },
      verified: true,
    };
  }
}
