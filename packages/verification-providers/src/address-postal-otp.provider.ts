import { randomInt } from 'node:crypto';
import { sha256Hex, constantTimeEqualHex } from '@nid/shared-types';
import type { PrismaClient } from '@nid/db';
import { withTenantContext } from '@nid/db';
import type { VerificationContext, VerificationMethodProvider, VerificationResult, PendingResult } from './types';

const CODE_LENGTH = 6;

export interface PostalOtpConfig {
  /** e.g. ADDRESS_POSTAL_OTP_API_URL — a real postal/mail-delivery vendor (Lob, PostGrid, a national postal service API, ...). */
  apiUrl?: string;
  /** e.g. ADDRESS_POSTAL_OTP_API_KEY. */
  apiKey?: string;
}

/**
 * The strongest of the three address-verification methods: a physical
 * letter carrying a one-time code, mailed to the subject's claimed
 * address, entered back once received — the postal system itself is an
 * authoritative third party attesting the address is real and reachable,
 * the same reasoning that earns this REGISTRY_VERIFIED in
 * method-attributes.ts. Same code-hash mechanism as otp_sms
 * (packages/verification-providers/src/otp-sms.provider.ts) — generate,
 * hash, deliver, compare on submission — deliberately NOT a shared base
 * class with it: the delivery channel, its real vendor contract, and
 * (critically) the wait duration are all genuinely different, and forcing
 * a shared abstraction over three lines of hash-compare logic would cost
 * more clarity than it saves.
 *
 * Mail takes DAYS, not minutes — packages/verification-providers/src/method-timeouts.ts
 * declares this method's real timeout accordingly, and apps/api's case
 * creation flow reads it when starting the Temporal workflow. Getting that
 * wrong (leaving the same ~10-minute default every fast method uses) would
 * make this method structurally unable to ever succeed.
 *
 * The claimed address lives on the Subject row (Subject.addressLine1/city/
 * region/countryCode — the same fields address_gps_match reads), not a
 * fresh per-case input, so both address methods verify against one
 * canonical claim.
 */
export class AddressPostalOtpProvider implements VerificationMethodProvider {
  readonly key = 'address_postal_otp';
  readonly label = 'Postal mail one-time code';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly devMode: boolean,
    private readonly config: PostalOtpConfig = {},
  ) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    const subject = await withTenantContext(this.prisma, context.tenantId, (tx) =>
      tx.subject.findUnique({ where: { id: context.subjectId } }),
    );
    if (!subject || !subject.addressLine1 || !subject.city || !subject.countryCode) {
      return { status: 'FAILED', raw: { reason: 'no_claimed_address_on_file' }, verified: false };
    }

    const code = randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
    const codeHash = sha256Hex(code);

    await this.mailCode(
      {
        addressLine1: subject.addressLine1,
        addressLine2: subject.addressLine2,
        city: subject.city,
        region: subject.region,
        countryCode: subject.countryCode,
      },
      code,
    );

    return { pending: true, resultMeta: { codeHash } };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const submittedCode = payload['submittedCode'];
    const codeHash = payload['codeHash'];

    if (typeof submittedCode !== 'string' || typeof codeHash !== 'string') {
      return { status: 'FAILED', raw: { reason: 'malformed_callback' }, verified: false };
    }

    const submittedHash = sha256Hex(submittedCode);
    const matches = constantTimeEqualHex(submittedHash, codeHash);

    return {
      status: matches ? 'PASSED' : 'FAILED',
      raw: { reason: matches ? 'code_matched' : 'code_mismatch' },
      verified: true,
    };
  }

  private async mailCode(
    address: { addressLine1: string; addressLine2: string | null; city: string; region: string | null; countryCode: string },
    code: string,
  ): Promise<void> {
    if (this.devMode) {
      // eslint-disable-next-line no-console
      console.log(`[address_postal_otp:dev] would mail code ${code} to`, address);
      return;
    }
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error(
        'address_postal_otp: no production postal vendor wired up yet. Set ADDRESS_POSTAL_OTP_DEV_MODE=true ' +
          'for local/dev use, or implement mailCode against a real postal/mail-delivery API before deploying.',
      );
    }

    let response: Response;
    try {
      response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ address, code }),
      });
    } catch (err) {
      throw new Error(
        `address_postal_otp: postal vendor request failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    if (!response.ok) {
      throw new Error(`address_postal_otp: postal vendor returned HTTP ${response.status}`);
    }
  }
}
