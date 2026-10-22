import { randomInt } from 'node:crypto';
import { sha256Hex, constantTimeEqualHex } from '@nid/shared-types';
import type {
  VerificationMethodProvider,
  VerificationContext,
  VerificationResult,
  PendingResult,
} from './types';

const CODE_LENGTH = 6;

/**
 * Sends a one-time code to the subject's phone and verifies it on submission.
 * Stateless by design (docs/HOUSE-RULES.md rule 1 / rule 2): start() returns
 * the hashed code as `resultMeta` for the caller to persist on the
 * VerificationMethodAttempt row; handleCallback() takes that same hash back
 * plus the submitted code, so this provider never touches the database
 * itself.
 *
 * In production, `sendSms` should be replaced with a real delivery API
 * (Twilio-class). OTP_SMS_DEV_MODE=true (the only mode implemented here)
 * logs the code instead of sending it — for local/dev/test only, never
 * enable in a deployed environment holding real subjects.
 */
export class OtpSmsProvider implements VerificationMethodProvider {
  readonly key = 'otp_sms';
  readonly label = 'SMS one-time code';

  constructor(private readonly devMode: boolean) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    const phone = context.input['phone'];
    if (typeof phone !== 'string' || phone.length === 0) {
      return {
        status: 'FAILED',
        raw: { reason: 'missing_phone' },
        verified: true,
      };
    }

    const code = randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
    const codeHash = sha256Hex(code);

    await this.sendSms(phone, code);

    return {
      pending: true,
      resultMeta: { codeHash, phone },
    };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const submittedCode = payload['submittedCode'];
    const expectedCodeHash = payload['codeHash'];

    if (typeof submittedCode !== 'string' || typeof expectedCodeHash !== 'string') {
      return { status: 'FAILED', raw: { reason: 'malformed_callback' }, verified: false };
    }

    const submittedHash = sha256Hex(submittedCode);
    const matches = constantTimeEqualHex(submittedHash, expectedCodeHash);

    return {
      status: matches ? 'PASSED' : 'FAILED',
      raw: { reason: matches ? 'code_matched' : 'code_mismatch' },
      verified: true,
    };
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    if (this.devMode) {
      // eslint-disable-next-line no-console
      console.log(`[otp_sms:dev] would send code ${code} to ${phone}`);
      return;
    }
    throw new Error(
      'otp_sms: no production SMS vendor wired up yet. Set OTP_SMS_DEV_MODE=true for local/dev use, or implement sendSms against a real delivery API before deploying.',
    );
  }
}
