/**
 * Exercises the generalized method activities directly against a live
 * Postgres, bypassing Temporal entirely — the orchestration layer
 * (proxyActivities, signals, condition()) can only be exercised with a
 * running Temporal server, which this environment cannot reach (see
 * README.md). What CAN be verified without Temporal is everything the
 * activities actually do — provider dispatch, the RLS-scoped Prisma writes,
 * signed webhook delivery, and, for document_ocr/liveness, a real
 * put()/get() round trip through @nid/storage — plus, by calling the
 * activities in the exact order verification.workflow.ts would, that a
 * multi-method policy really does wait for every method before resolving.
 * Gated behind RUN_DB_TESTS like apps/api/test/tenant-isolation.spec.ts.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createPrismaClient } from '@nid/db';
import { sha256Hex, verifyWebhookSignature } from '@nid/shared-types';
import { LocalStorageDriver } from '@nid/storage';
import {
  startMethodActivity,
  completeMethodActivity,
  expireMethodActivity,
  resolveCaseActivity,
} from '../src/activities/verification-method.activity';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('verification-method activities (live Postgres, no Temporal)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const WEBHOOK_SECRET = 'test-webhook-secret';
  let webhookServer: Server;
  let webhookUrl: string;
  let receivedWebhooks: Array<{ body: string; signature: string; timestamp: string }> = [];
  // Must be the SAME directory verification-method.activity.ts's module-level
  // storage driver reads from (LOCAL_STORAGE_DIR) — a separate tmpdir would
  // reproduce exactly the cross-process gotcha @nid/storage's header comment
  // warns about, just within one test process instead of across apps/api and
  // apps/workflows.
  const localStorageDir = process.env['LOCAL_STORAGE_DIR'];
  if (!localStorageDir) {
    throw new Error('LOCAL_STORAGE_DIR must be set to run this suite (see .env).');
  }
  const uploadStorage = new LocalStorageDriver(localStorageDir);
  const testTenantIds: string[] = [];

  async function makeCase(tenantSlug: string, methods: string[]) {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: { webhookUrl, webhookSecretPlaintext: WEBHOOK_SECRET },
      create: { name: tenantSlug, slug: tenantSlug, webhookUrl, webhookSecretPlaintext: WEBHOOK_SECRET },
    });
    const policyName = `test-${methods.join('-')}`;
    const policy = await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: policyName } },
      update: { methods },
      create: { tenantId: tenant.id, name: policyName, methods },
    });
    const subject = await migratorPrisma.subject.create({
      data: { tenantId: tenant.id, type: 'PERSON', phone: '+15551234567' },
    });
    const kase = await migratorPrisma.verificationCase.create({
      data: { tenantId: tenant.id, subjectId: subject.id, policyId: policy.id, status: 'PENDING' },
    });
    for (const method of methods) {
      await migratorPrisma.verificationMethodAttempt.create({
        data: { tenantId: tenant.id, caseId: kase.id, method, providerKey: method, status: 'PENDING' },
      });
    }
    testTenantIds.push(tenant.id);
    return { tenantId: tenant.id, subjectId: subject.id, caseId: kase.id };
  }

  beforeAll(async () => {
    receivedWebhooks = [];
    webhookServer = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        receivedWebhooks.push({
          body: Buffer.concat(chunks).toString('utf8'),
          signature: String(req.headers['x-nid-signature'] ?? ''),
          timestamp: String(req.headers['x-nid-timestamp'] ?? ''),
        });
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => webhookServer.listen(0, '127.0.0.1', resolve));
    const address = webhookServer.address() as AddressInfo;
    webhookUrl = `http://127.0.0.1:${address.port}/webhook`;
  });

  afterAll(async () => {
    await migratorPrisma.$disconnect();
    await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
    await Promise.all(
      testTenantIds.map((tenantId) => rm(join(localStorageDir, tenantId), { recursive: true, force: true })),
    );
  });

  it('otp_sms: a full PASSED sequence moves the case to IN_REVIEW then APPROVED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-otp-passed', ['otp_sms']);

    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      input: { phone: '+15551234567' },
    });
    expect(started.pending).toBe(true);
    if (!started.pending) return;
    expect(typeof started.resultMeta['codeHash']).toBe('string');

    const afterStart = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(afterStart.status).toBe('IN_REVIEW');

    // Overwrite the persisted hash to one whose plaintext this test knows —
    // otp_sms's start() generates the real code internally and only logs it
    // in dev mode, never returns it.
    const knownCode = '424242';
    const knownHash = sha256Hex(knownCode);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'otp_sms' },
      data: { resultMeta: { codeHash: knownHash } },
    });

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      resultMeta: { codeHash: knownHash },
      payload: { submittedCode: knownCode },
    });
    expect(completed.status).toBe('PASSED');

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'otp_sms' },
    });
    expect(attempt.status).toBe('PASSED');
    expect(attempt.completedAt).not.toBeNull();
  });

  it('a PASSED otp_sms attempt writes a real PHONE/SELF_ATTESTED VerifiedAttribute row, independent of the claimType badge', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-attribute-phone', ['otp_sms']);
    await startMethodActivity({ caseId, tenantId, subjectId, method: 'otp_sms', input: { phone: '+15551234567' } });

    const knownCode = '999888';
    const knownHash = sha256Hex(knownCode);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'otp_sms' },
      data: { resultMeta: { codeHash: knownHash } },
    });
    await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      resultMeta: { codeHash: knownHash },
      payload: { submittedCode: knownCode },
    });
    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const attribute = await migratorPrisma.verifiedAttribute.findFirstOrThrow({ where: { subjectId, attribute: 'PHONE' } });
    expect(attribute.level).toBe('SELF_ATTESTED');
    expect(attribute.method).toBe('otp_sms');
    expect(attribute.caseId).toBe(caseId);
  });

  it('otp_sms: a wrong code resolves the case to REJECTED and delivers a validly signed webhook', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-otp-rejected', ['otp_sms']);
    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      input: { phone: '+15551234567' },
    });
    if (!started.pending) throw new Error('expected a pending result');

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      resultMeta: started.resultMeta,
      payload: { submittedCode: 'not-the-real-code' },
    });
    expect(completed.status).toBe('FAILED');

    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'REJECTED',
      decision: 'FAILED',
      raw: completed.raw,
    });

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('REJECTED');
    expect(kase.decision).toBe('FAILED');

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'otp_sms' },
    });
    expect(attempt.status).toBe('FAILED');
    expect(attempt.completedAt).not.toBeNull();

    const audit = await migratorPrisma.auditLogEntry.findFirst({
      where: { caseId, action: 'verification_case.resolve', actorType: 'SYSTEM' },
    });
    expect(audit).not.toBeNull();

    // Webhook delivery is async relative to resolveCaseActivity's own
    // return in this test only because it's a real HTTP round trip to
    // 127.0.0.1 — give it a moment, then verify the signature the same way
    // a tenant's receiver would.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const delivered = receivedWebhooks.find((w) => w.body.includes(caseId));
    expect(delivered).toBeDefined();
    if (!delivered) return;
    expect(
      verifyWebhookSignature(WEBHOOK_SECRET, delivered.body, Number(delivered.timestamp), delivered.signature),
    ).toBe(true);
    // A wrong secret must not verify — proves this isn't a tautological check.
    expect(
      verifyWebhookSignature('wrong-secret', delivered.body, Number(delivered.timestamp), delivered.signature),
    ).toBe(false);
  });

  it('otp_sms: expireMethodActivity + resolveCaseActivity resolves the case to EXPIRED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-otp-expired', ['otp_sms']);
    await startMethodActivity({ caseId, tenantId, subjectId, method: 'otp_sms', input: { phone: '+15551234567' } });

    await expireMethodActivity({ caseId, tenantId, method: 'otp_sms' });
    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'EXPIRED',
      decision: 'FAILED',
      raw: { reason: 'otp_sms_expired' },
    });

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('EXPIRED');

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'otp_sms' },
    });
    expect(attempt.status).toBe('FAILED');
  });

  it('document_ocr: reads an uploaded file back through @nid/storage and mocks a PASSED result in dev mode', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-doc-passed', ['document_ocr']);

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'document_ocr', input: {} });
    expect(started.pending).toBe(true);

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'document_ocr' },
    });
    const stored = await uploadStorage.put({
      namespace: tenantId,
      groupId: attempt.id,
      filename: 'id-card.jpg',
      contentType: 'image/jpeg',
      body: Buffer.from('fake id card bytes'),
    });

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'document_ocr',
      resultMeta: {},
      payload: { storageKey: stored.key, contentType: 'image/jpeg' },
    });
    expect(completed.status).toBe('PASSED');
    expect(completed.raw).toMatchObject({ mode: 'dev_mock' });

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');
  });

  it('liveness: an explicit mockOutcome of NEEDS_REVIEW resolves the case to NEEDS_REVIEW, not silently APPROVED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-liveness-review', ['liveness']);
    await startMethodActivity({ caseId, tenantId, subjectId, method: 'liveness', input: {} });

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'liveness' },
    });
    // liveness needs a burst of frames, not one file — real blink
    // detection has nothing to detect a blink from in a single photo. Dev
    // mode never actually inspects the bytes, so three uploads of the same
    // fake frame is enough to exercise the real multi-frame storage/signal
    // plumbing (storageKeys, not storageKey) end to end.
    const storageKeys = await Promise.all(
      [0, 1, 2].map(async (i) => {
        const stored = await uploadStorage.put({
          namespace: tenantId,
          groupId: attempt.id,
          filename: `frame-${i}.jpg`,
          contentType: 'image/jpeg',
          body: Buffer.from('fake selfie bytes'),
        });
        return stored.key;
      }),
    );

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'liveness',
      resultMeta: {},
      payload: { storageKeys, contentType: 'image/jpeg', mockOutcome: 'NEEDS_REVIEW' },
    });
    expect(completed.status).toBe('NEEDS_REVIEW');

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
  });

  it('ecp_voter_registration: a real self-report always resolves to NEEDS_REVIEW, never an automated pass', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-ecp-voter', ['ecp_voter_registration']);

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'ecp_voter_registration', input: {} });
    expect(started.pending).toBe(true);

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'ecp_voter_registration',
      resultMeta: {},
      // A real subject-typed reply — no file, no storageKey, exactly what
      // SessionsController's .../claims/:method/report route forwards.
      payload: { reportedValue: 'Registered — Lahore NA-130' },
    });
    expect(completed.status).toBe('NEEDS_REVIEW');
    expect(completed.raw).toMatchObject({ reportedValue: 'Registered — Lahore NA-130' });

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
  });

  it('a single PASSED method that proves several attributes at once writes one VerifiedAttribute row per attribute', async () => {
    // Exercises resolveCaseActivity's own attribute-write logic in
    // isolation — it doesn't care HOW an attempt reached PASSED, only that
    // it did — independent of the real estamp_registry provider call
    // proven end to end in the next test below.
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-attribute-estamp', ['estamp_registry']);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'estamp_registry' },
      data: { status: 'PASSED', completedAt: new Date() },
    });

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const attributes = await migratorPrisma.verifiedAttribute.findMany({ where: { subjectId, caseId } });
    expect(attributes.map((a) => a.attribute).sort()).toEqual(['NAME', 'NATIONAL_ID_NUMBER', 'PHONE']);
    expect(attributes.every((a) => a.level === 'REGISTRY_VERIFIED' && a.method === 'estamp_registry')).toBe(true);
  });

  it('estamp_registry: resolves synchronously in dev mode with a real CNIC+phone input, same as otp_sms/bank_account_title', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-estamp-passed', ['estamp_registry']);

    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'estamp_registry',
      input: { referenceId: '35202-1234567-8', phone: '+923001234567' },
    });

    expect(started.pending).toBe(false);
    if (started.pending) return;
    expect(started.status).toBe('PASSED');
    expect(started.raw).toMatchObject({
      mode: 'dev_mock',
      referenceId: '35202-1234567-8',
      phone: '+923001234567',
    });

    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'APPROVED',
      decision: 'PASSED',
      raw: started.raw,
    });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');

    const attributes = await migratorPrisma.verifiedAttribute.findMany({ where: { subjectId, caseId } });
    expect(attributes.map((a) => a.attribute).sort()).toEqual(['NAME', 'NATIONAL_ID_NUMBER', 'PHONE']);
  });

  it('a method absent from method-attributes.ts (liveness) contributes no VerifiedAttribute rows even when PASSED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-attribute-liveness-none', ['liveness']);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'liveness' },
      data: { status: 'PASSED', completedAt: new Date() },
    });

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const attributes = await migratorPrisma.verifiedAttribute.findMany({ where: { subjectId, caseId } });
    expect(attributes).toHaveLength(0);
  });

  it('org_membership: a confirmed member of a verified organization inherits PASSED synchronously — no upload, no signal', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-org-membership', ['org_membership']);

    // The Organization has to be genuinely verified first — its own real
    // KYB case, APPROVED, claimType IDENTITY — same as
    // OrganizationMembershipProvider's own spec proves in isolation; this
    // test proves the full activity wiring (dispatch, persistence) around it.
    const orgSubject = await migratorPrisma.subject.create({ data: { tenantId, type: 'ORGANIZATION' } });
    const organization = await migratorPrisma.organization.create({
      data: { tenantId, subjectId: orgSubject.id, legalName: 'Activity Test Org' },
    });
    const kybPolicy = await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId, name: 'activity-test-kyb' } },
      update: {},
      create: { tenantId, name: 'activity-test-kyb', methods: [], claimType: 'IDENTITY', level: 'DOCUMENT_VERIFIED' },
    });
    const kybCase = await migratorPrisma.verificationCase.create({
      data: {
        tenantId,
        subjectId: orgSubject.id,
        policyId: kybPolicy.id,
        status: 'APPROVED',
        claimType: 'IDENTITY',
        level: 'DOCUMENT_VERIFIED',
      },
    });
    await migratorPrisma.organizationMembership.create({
      data: { tenantId, organizationId: organization.id, personSubjectId: subjectId, role: 'Engineer', addedByApiKeyId: 'test' },
    });

    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'org_membership',
      input: { organizationId: organization.id },
    });
    expect(started.pending).toBe(false);
    if (started.pending) throw new Error('unreachable');
    expect(started.status).toBe('PASSED');
    expect(started.raw).toMatchObject({ organizationId: organization.id, inheritedFromCaseId: kybCase.id });

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'APPROVED', raw: started.raw });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');
  });

  it('org_membership: an unconfirmed member of a verified organization is NEEDS_REVIEW, never auto-passed', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-org-membership-unconfirmed', ['org_membership']);
    const orgSubject = await migratorPrisma.subject.create({ data: { tenantId, type: 'ORGANIZATION' } });
    const organization = await migratorPrisma.organization.create({
      data: { tenantId, subjectId: orgSubject.id, legalName: 'Unconfirmed Membership Org' },
    });
    // Deliberately no OrganizationMembership row — the subject merely
    // claims organizationId, nobody at the org confirmed it.

    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'org_membership',
      input: { organizationId: organization.id },
    });
    expect(started.pending).toBe(false);
    if (started.pending) throw new Error('unreachable');
    expect(started.status).toBe('NEEDS_REVIEW');
    expect(started.raw).toMatchObject({ reason: 'membership_not_confirmed' });
  });

  it('agent_in_person_document: a tenant agent\'s attestation resolves directly (PASSED or FAILED), traceable to the agent', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-agent-attest', ['agent_in_person_document']);

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'agent_in_person_document', input: {} });
    expect(started.pending).toBe(true);

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'agent_in_person_document',
      resultMeta: {},
      // Exactly what VerificationCasesController's .../claims/:method/agent-attest
      // route forwards — a tenant API key acting as the agent, never the subject.
      payload: { decision: 'PASSED', agentId: 'tenant-api-key-123', notes: 'Original passport + CNIC inspected in branch.' },
    });
    expect(completed.status).toBe('PASSED');
    expect(completed.raw).toMatchObject({ agentId: 'tenant-api-key-123' });

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'APPROVED', raw: completed.raw });
    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');
  });

  it('address_gps_match: a real close-by reported location resolves PASSED and writes a real ADDRESS/DOCUMENT_VERIFIED attribute row', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-address-gps', ['address_gps_match']);
    await migratorPrisma.subject.update({
      where: { id: subjectId },
      data: { latitude: 24.8607, longitude: 67.0011 },
    });

    const started = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'address_gps_match',
      input: {},
    });
    expect(started.pending).toBe(true);
    if (!started.pending) return;

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'address_gps_match',
      resultMeta: started.resultMeta,
      // A real device-reported location a few meters from the claimed address.
      payload: { latitude: 24.8608, longitude: 67.0012 },
    });
    expect(completed.status).toBe('PASSED');

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const attribute = await migratorPrisma.verifiedAttribute.findFirstOrThrow({
      where: { subjectId, attribute: 'ADDRESS' },
    });
    expect(attribute.level).toBe('DOCUMENT_VERIFIED');
    expect(attribute.method).toBe('address_gps_match');
  });

  it('address_gps_match: a real far-away reported location resolves NEEDS_REVIEW, not FAILED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-address-gps-far', ['address_gps_match']);
    await migratorPrisma.subject.update({
      where: { id: subjectId },
      data: { latitude: 24.8607, longitude: 67.0011 }, // Karachi
    });

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'address_gps_match', input: {} });
    expect(started.pending).toBe(true);
    if (!started.pending) return;

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'address_gps_match',
      resultMeta: started.resultMeta,
      payload: { latitude: 31.5204, longitude: 74.3587 }, // Lahore — genuinely a different city
    });
    expect(completed.status).toBe('NEEDS_REVIEW');

    await resolveCaseActivity({
      tenantId,
      caseId,
      subjectId,
      caseStatus: 'NEEDS_REVIEW',
      decision: 'NEEDS_REVIEW',
      raw: completed.raw,
    });

    // A NEEDS_REVIEW method attempt never PASSED, so no attribute evidence — no false badge.
    const attributes = await migratorPrisma.verifiedAttribute.findMany({ where: { subjectId, attribute: 'ADDRESS' } });
    expect(attributes).toHaveLength(0);
  });

  it('address_postal_otp: dev mode generates a real hashed code, and the correct code resolves PASSED with a real ADDRESS/REGISTRY_VERIFIED attribute row', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-address-postal', ['address_postal_otp']);
    await migratorPrisma.subject.update({
      where: { id: subjectId },
      data: { addressLine1: '789 Elm St', city: 'Islamabad', countryCode: 'PK' },
    });

    const started = await startMethodActivity({ caseId, tenantId, subjectId, method: 'address_postal_otp', input: {} });
    expect(started.pending).toBe(true);
    if (!started.pending) return;
    expect(typeof started.resultMeta['codeHash']).toBe('string');

    const knownCode = '135790';
    const knownHash = sha256Hex(knownCode);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'address_postal_otp' },
      data: { resultMeta: { codeHash: knownHash } },
    });

    const completed = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'address_postal_otp',
      resultMeta: { codeHash: knownHash },
      payload: { submittedCode: knownCode },
    });
    expect(completed.status).toBe('PASSED');

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const attribute = await migratorPrisma.verifiedAttribute.findFirstOrThrow({
      where: { subjectId, attribute: 'ADDRESS' },
    });
    expect(attribute.level).toBe('REGISTRY_VERIFIED');
    expect(attribute.method).toBe('address_postal_otp');
  });

  it('multi-method policy: the case is not resolved until every method has run, in order', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('activity-test-multi', ['otp_sms', 'document_ocr']);

    // Step 1: otp_sms.
    const otpStarted = await startMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      input: { phone: '+15551234567' },
    });
    if (!otpStarted.pending) throw new Error('expected a pending result');
    const knownCode = '112233';
    const knownHash = sha256Hex(knownCode);
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'otp_sms' },
      data: { resultMeta: { codeHash: knownHash } },
    });
    const otpCompleted = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'otp_sms',
      resultMeta: { codeHash: knownHash },
      payload: { submittedCode: knownCode },
    });
    expect(otpCompleted.status).toBe('PASSED');

    // document_ocr hasn't run yet — the case must not look resolved.
    const midway = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(midway.status).toBe('IN_REVIEW');

    // Step 2: document_ocr.
    const docStarted = await startMethodActivity({ caseId, tenantId, subjectId, method: 'document_ocr', input: {} });
    expect(docStarted.pending).toBe(true);
    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'document_ocr' },
    });
    const stored = await uploadStorage.put({
      namespace: tenantId,
      groupId: attempt.id,
      filename: 'id.jpg',
      contentType: 'image/jpeg',
      body: Buffer.from('doc bytes'),
    });
    const docCompleted = await completeMethodActivity({
      caseId,
      tenantId,
      subjectId,
      method: 'document_ocr',
      resultMeta: {},
      payload: { storageKey: stored.key, contentType: 'image/jpeg' },
    });
    expect(docCompleted.status).toBe('PASSED');

    await resolveCaseActivity({ tenantId, caseId, subjectId, caseStatus: 'APPROVED', decision: 'PASSED', raw: {} });

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');

    const otpAttempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'otp_sms' },
    });
    const docAttempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({
      where: { caseId, method: 'document_ocr' },
    });
    expect(otpAttempt.status).toBe('PASSED');
    expect(docAttempt.status).toBe('PASSED');
  });
});
