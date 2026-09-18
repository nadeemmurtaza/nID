import type { PrismaClient } from '@nid/db';
import { withTenantContext } from '@nid/db';
import type { VerificationContext, VerificationMethodProvider, VerificationResult, PendingResult } from './types';
import { haversineDistanceMeters } from './geo-distance';

/** Real-world GPS accuracy in dense urban areas, plus a margin for a large property — not a precise property-boundary check. */
const DEFAULT_MAX_DISTANCE_METERS = 500;

/**
 * "Does the subject's current device location match the address they
 * claimed?" — a real, direct check, not proof of residency by itself (the
 * subject could be visiting, not living there), which is exactly why a
 * mismatch resolves to NEEDS_REVIEW rather than FAILED: being far from a
 * claimed address right now is a real signal, but not deterministic proof
 * the claim itself is false (the subject might just not be home, or the
 * address on file might be stale) — the same honesty standard every other
 * ambiguous outcome in this codebase already follows.
 *
 * The claimed address's coordinates live on the Subject row itself
 * (Subject.latitude/longitude — set when the subject reports their
 * address, e.g. alongside a KYC form), looked up here directly since this
 * provider's contract has nothing else to carry them in through — the
 * second provider in this package (after OrganizationMembershipProvider)
 * to query nID's own data rather than a vendor or an upload.
 */
export class AddressGpsMatchProvider implements VerificationMethodProvider {
  readonly key = 'address_gps_match';
  readonly label = 'Address match via current location';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly maxDistanceMeters: number = DEFAULT_MAX_DISTANCE_METERS,
  ) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    return withTenantContext(this.prisma, context.tenantId, async (tx) => {
      const subject = await tx.subject.findUnique({ where: { id: context.subjectId } });
      if (!subject || subject.latitude === null || subject.longitude === null) {
        return { status: 'FAILED', raw: { reason: 'no_claimed_address_coordinates' }, verified: false };
      }
      // Nothing to send the subject — their next step is sharing their
      // device's current location, same shape as otp_sms's code wait.
      return {
        pending: true,
        resultMeta: { expectedLatitude: subject.latitude, expectedLongitude: subject.longitude },
      };
    });
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const latitude = payload['latitude'];
    const longitude = payload['longitude'];
    const expectedLatitude = payload['expectedLatitude'];
    const expectedLongitude = payload['expectedLongitude'];

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      typeof expectedLatitude !== 'number' ||
      typeof expectedLongitude !== 'number'
    ) {
      return { status: 'FAILED', raw: { reason: 'missing_coordinates' }, verified: false };
    }

    const distanceMeters = haversineDistanceMeters(latitude, longitude, expectedLatitude, expectedLongitude);
    const withinRange = distanceMeters <= this.maxDistanceMeters;

    return {
      status: withinRange ? 'PASSED' : 'NEEDS_REVIEW',
      raw: {
        distanceMeters: Math.round(distanceMeters),
        maxDistanceMeters: this.maxDistanceMeters,
        reason: withinRange ? undefined : 'location_too_far_from_claimed_address',
      },
      verified: true,
    };
  }
}
