/**
 * Exercises the REAL (non-dev-mode) liveness pipeline through the activity
 * layer — real @nid/liveness-engine face detection against real Postgres
 * and real @nid/storage, proving the multi-frame + reference-image wiring
 * task 58 built (resolveProviderPayload's storageKeys/referenceStorageKey
 * branch, VerificationCasesService.submitLiveness's DocumentAsset
 * bookkeeping) actually reaches the real engine, not a mock.
 *
 * A SEPARATE file from verification-method.activity.spec.ts on purpose:
 * that file's own liveness test needs LIVENESS_DEV_MODE=true (the default
 * in .env) for its dev-mode-mock assertions, while this one needs
 * LIVENESS_DEV_MODE=false so buildVerificationProviderRegistry() (built
 * once, at module import time, from process.env) constructs a real
 * LivenessProvider — the two can't coexist in one process/env. Gated on
 * BOTH RUN_DB_TESTS=true and LIVENESS_DEV_MODE=false so it silently skips
 * under every other invocation (the default `pnpm test` run included,
 * which keeps .env's LIVENESS_DEV_MODE=true) rather than accidentally
 * running against the wrong mode. Invoke explicitly:
 *   LIVENESS_DEV_MODE=false RUN_DB_TESTS=true pnpm test test/liveness-real.activity.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Jimp } from 'jimp';
import { createPrismaClient } from '@nid/db';
import {
  startMethodActivity,
  completeMethodActivity,
  resolveCaseActivity,
} from '../src/activities/verification-method.activity';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const REAL_LIVENESS = process.env['LIVENESS_DEV_MODE'] === 'false';
const describeIfRealLiveness = RUN_DB_TESTS && REAL_LIVENESS ? describe : describe.skip;

function samplePhoto(name: 'sample1' | 'sample2'): Buffer {
  const demoDir = join(dirname(require.resolve('@vladmandic/face-api/package.json')), 'demo');
  return readFileSync(join(demoDir, `${name}.jpg`));
}

/** A real, decodable image with no face in it at all — a plain color field. */
async function blankImage(): Promise<Buffer> {
  const image = new Jimp({ width: 200, height: 200, color: 0x808080ff });
  return image.getBuffer('image/jpeg');
}

describeIfRealLiveness('liveness activity, real engine (live Postgres + real @nid/storage)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const localStorageDir = process.env['LOCAL_STORAGE_DIR'];
  if (!localStorageDir) {
    throw new Error('LOCAL_STORAGE_DIR must be set to run this suite (see .env).');
  }

  async function makeCase(tenantSlug: string) {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: {},
      create: { name: tenantSlug, slug: tenantSlug },
    });
    const policyName = `test-liveness-real`;
    const policy = await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: policyName } },
      update: { methods: ['liveness'] },
      create: { tenantId: tenant.id, name: policyName, methods: ['liveness'] },
    });
    const subject = await migratorPrisma.subject.create({ data: { tenantId: tenant.id, type: 'PERSON' } });
    const kase = await migratorPrisma.verificationCase.create({
      data: { tenantId: tenant.id, subjectId: subject.id, policyId: policy.id, status: 'PENDING' },
    });
    await migratorPrisma.verificationMethodAttempt.create({
      data: { tenantId: tenant.id, caseId: kase.id, method: 'liveness', providerKey: 'liveness', status: 'PENDING' },
    });
    return { tenantId: tenant.id, subjectId: subject.id, caseId: kase.id };
  }

  afterAll(async () => {
    await migratorPrisma.$disconnect();
  });

  it('a real burst with no face at all resolves FAILED through the real engine, not a mock', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-liveness-real-no-face');

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'liveness', input: {} });
    expect(started.pending).toBe(true);

    // Three real, decodable but faceless JPEGs — real bytes, just no face
    // in them, so the real detector genuinely finds nothing.
    const blank = await blankImage();
    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'liveness',
      resultMeta: {},
      payload: { framesBytes: [blank, blank, blank], contentType: 'image/jpeg' },
    });
    expect(completed.status).toBe('FAILED');
    expect(completed.raw).toMatchObject({ rejectionReason: 'no_face_in_frame' });

    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'REJECTED',
      decision: 'REJECTED',
      raw: completed.raw,
    });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('REJECTED');
  }, 30000);

  it('a real single-person burst with no blink resolves NEEDS_REVIEW through the real engine', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-liveness-real-no-blink');
    const photo = samplePhoto('sample2'); // confirmed single-face during development

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'liveness', input: {} });
    expect(started.pending).toBe(true);

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'liveness',
      resultMeta: {},
      payload: { framesBytes: [photo, photo, photo], contentType: 'image/jpeg' },
    });
    expect(completed.status).toBe('NEEDS_REVIEW');
    expect(completed.raw).toMatchObject({ reason: 'no_blink_detected', facesConsistent: true });

    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'NEEDS_REVIEW',
      decision: 'NEEDS_REVIEW',
      raw: completed.raw,
    });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('NEEDS_REVIEW');
  }, 30000);

  it('a real reference image of the same person genuinely matches through the real engine', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-liveness-real-match');
    const photo = samplePhoto('sample2');

    await startMethodActivity({ caseId, tenantId, subjectId, method: 'liveness', input: {} });

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'liveness',
      resultMeta: {},
      payload: {
        framesBytes: [photo, photo, photo],
        contentType: 'image/jpeg',
        referenceImageBytes: photo,
      },
    });

    // Same photo as both selfie and reference — real distance is 0,
    // matchedReference true — but still no blink across three identical
    // frames, so the honest outcome is still NEEDS_REVIEW, not PASSED.
    // This proves referenceImageBytes really reached the real engine (a
    // mismatch would have forced FAILED regardless of blink — see
    // mapEvaluationToResult's priority order).
    expect(completed.status).toBe('NEEDS_REVIEW');
    expect(completed.raw).toMatchObject({ matchedReference: true, referenceMatchDistance: 0 });
  }, 30000);
});
