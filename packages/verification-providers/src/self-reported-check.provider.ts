import type { VerificationMethodProvider, VerificationResult, PendingResult } from './types';

/**
 * For a government check with no institutional API and no self-serve
 * signup at all — not even the "requires an agreement" story
 * RegistryCheckProvider tells for NSC/Truework/a bank. Pakistan's ECP
 * voter-registration lookup (send a CNIC via SMS to 8300) is a *consumer*
 * self-service tool: there is no sanctioned way for a third party to query
 * it on someone else's behalf. Scraping it or spoofing an SMS gateway at
 * scale would be exactly the kind of shortcut this codebase doesn't take.
 *
 * What IS honest: the subject already holds the one channel that can
 * reach this service (their own phone), so they run the check themselves
 * and report back what the government's reply said. This provider takes
 * that self-report — never a file, just text plus whatever evidence
 * accompanies it — and always resolves to NEEDS_REVIEW. Never PASSED,
 * never FAILED: nothing here independently confirms the subject didn't
 * just type in a fake reply, so an automated pass would be exactly the
 * "silently forced" result CaseStatus.NEEDS_REVIEW's own schema comment
 * warns against. A human reviewer's judgment call (the manual-review
 * queue's resolve action) is the honest terminal state this method can
 * ever reach on its own.
 *
 * PTA's SIM-count lookup (text a CNIC to 668) was deliberately NOT wired
 * up as a sibling of this provider: it doesn't answer a pass/fail claim
 * the way voter registration does ("is this person a registered voter"),
 * it returns a number that's a supplementary risk signal ("does this CNIC
 * have an unusual number of SIMs") — forcing it into VerificationCase's
 * pass/fail claim model would misrepresent what it actually proves. It
 * belongs in a future risk-signal layer attached to a Subject, not here.
 */
export class SelfReportedCheckProvider implements VerificationMethodProvider {
  constructor(
    readonly key: string,
    readonly label: string,
  ) {}

  async start(): Promise<PendingResult> {
    // Nothing to check yet — the subject's next step is reporting back
    // what they were told, exactly like document_ocr/liveness have
    // nothing to send until an upload arrives.
    return { pending: true };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const reportedValue = payload['reportedValue'];
    if (typeof reportedValue !== 'string' || reportedValue.trim().length === 0) {
      return { status: 'FAILED', raw: { reason: 'missing_reported_value' }, verified: false };
    }

    return {
      status: 'NEEDS_REVIEW',
      raw: { reportedValue: reportedValue.trim() },
      // The callback itself is a legitimate submission from the subject —
      // `verified` gates whether this result is trustworthy enough to
      // persist at all, which it is; it says nothing about whether the
      // *claim* is true, which is exactly why status can never be
      // anything but NEEDS_REVIEW here.
      verified: true,
    };
  }
}
