/**
 * Shared by every dev-mode-mocked provider (image-based or not): the
 * `mockOutcome` override lets a test force PASSED/FAILED/NEEDS_REVIEW
 * deterministically instead of always getting the default PASSED, and
 * `mockScoreFor` gives that forced outcome a believable-looking confidence
 * score. Never used in production — every provider that mocks throws
 * instead when its dev-mode flag is off.
 */
export type MockOutcome = 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';

const MOCK_OUTCOMES: ReadonlySet<string> = new Set<MockOutcome>(['PASSED', 'FAILED', 'NEEDS_REVIEW']);

export function isValidMockOutcome(value: unknown): value is MockOutcome {
  return typeof value === 'string' && MOCK_OUTCOMES.has(value);
}

export function mockScoreFor(status: MockOutcome): number {
  if (status === 'PASSED') return 0.97;
  if (status === 'NEEDS_REVIEW') return 0.55;
  return 0.08;
}
