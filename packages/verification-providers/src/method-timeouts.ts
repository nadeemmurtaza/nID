/**
 * How long a Temporal workflow should wait for a method's pending step to
 * be completed before treating it as expired. Every method this codebase
 * built before address_postal_otp genuinely completes within minutes (an
 * SMS arrives in seconds, a subject uploads a photo within a session), so
 * one global default served every method fine. Physical mail delivery
 * takes DAYS, not minutes — a real, materially different timeframe this
 * codebase must not paper over with the same default, since that would
 * make address_postal_otp a method that structurally can never succeed
 * (the case would always expire before the letter could possibly arrive).
 *
 * A static, predefined map — never a workflow branching on method name
 * (docs/HOUSE-RULES.md rule 1): apps/api's case-creation flow reads this
 * to populate VerificationWorkflowInput.methodTimeouts per method in the
 * policy; the workflow itself just reads whatever duration it was given,
 * falling back to DEFAULT_METHOD_TIMEOUT for any method with no override.
 * Temporal's `condition()` timeout string format (e.g. "10 minutes",
 * "7 days").
 */
export const DEFAULT_METHOD_TIMEOUT = '10 minutes';

export const METHOD_TIMEOUTS: Record<string, string> = {
  address_postal_otp: '7 days',
};

export function methodTimeout(method: string): string {
  return METHOD_TIMEOUTS[method] ?? DEFAULT_METHOD_TIMEOUT;
}
