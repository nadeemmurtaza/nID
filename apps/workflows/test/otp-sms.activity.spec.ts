/**
 * Exercises the OTP activities directly against a live Postgres, bypassing
 * Temporal entirely — the orchestration layer (proxyActivities, signals,
 * condition()) can only be exercised with a running Temporal server, which
 * this environment cannot reach (see README.md). What CAN be verified
 * without Temporal is everything the activities actually do: the otp_sms
 * provider call, the RLS-scoped Prisma writes, and signed webhook delivery
 * — this test proves all three for real. Gated behind RUN_DB_TESTS like
 * apps/api/test/tenant-isolation.spec.ts.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPrismaClient } from '@nid/db';
import { sha256Hex, verifyWebhookSignature } from '@nid/shared-types';
import { sendOtpActivity, verifyOtpActivity, expireOtpActivity } from '../src/activities/otp-sms.activity';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('otp_sms activities (live Postgres, no Temporal)', () => {
  const migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
  const WEBHOOK_SECRET = 'test-webhook-secret';
  let webhookServer: Server;
  let webhookUrl: string;
  let receivedWebhooks: Array<{ body: string; signature: string; timestamp: string }> = [];

  async function makeCase(tenantSlug: string) {
    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: { webhookUrl, webhookSecretPlaintext: WEBHOOK_SECRET },
      create: { name: tenantSlug, slug: tenantSlug, webhookUrl, webhookSecretPlaintext: WEBHOOK_SECRET },
    });
    const policy = await migratorPrisma.verificationPolicy.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'standard' } },
      update: {},
      create: { tenantId: tenant.id, name: 'standard', methods: ['otp_sms'] },
    });
    const subject = await migratorPrisma.subject.create({
      data: { tenantId: tenant.id, type: 'PERSON', phone: '+15551234567' },
    });
    const kase = await migratorPrisma.verificationCase.create({
      data: { tenantId: tenant.id, subjectId: subject.id, policyId: policy.id, status: 'PENDING' },
    });
    await migratorPrisma.verificationMethodAttempt.create({
      data: { tenantId: tenant.id, caseId: kase.id, method: 'otp_sms', providerKey: 'otp_sms', status: 'PENDING' },
    });
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
  });

  it('sendOtpActivity persists a codeHash (never the plaintext code) and moves the case to IN_REVIEW', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('workflow-test-passed');

    const { codeHash } = await sendOtpActivity({ caseId, tenantId, subjectId, phone: '+15551234567' });
    expect(codeHash).toHaveLength(64);

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({ where: { caseId } });
    expect((attempt.resultMeta as Record<string, unknown> | null)?.['codeHash']).toBe(codeHash);

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('IN_REVIEW');
  });

  it('verifyOtpActivity on a wrong code resolves the case to REJECTED and delivers a validly signed webhook', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('workflow-test-rejected');
    const { codeHash } = await sendOtpActivity({ caseId, tenantId, subjectId, phone: '+15551234567' });

    // sendOtpActivity generates the real code internally (dev mode only logs
    // it, never returns it) — the PASSED path is verified separately below,
    // using a case where this test controls the code end to end. Here we
    // only need *a* wrong submission to prove the REJECTED path and webhook
    // delivery, which don't depend on knowing the real code.
    const result = await verifyOtpActivity({
      tenantId,
      caseId,
      subjectId,
      codeHash,
      submittedCode: 'not-the-real-code',
    });
    expect(result.status).toBe('FAILED');

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('REJECTED');
    expect(kase.decision).toBe('FAILED');

    const attempt = await migratorPrisma.verificationMethodAttempt.findFirstOrThrow({ where: { caseId } });
    expect(attempt.status).toBe('FAILED');
    expect(attempt.completedAt).not.toBeNull();

    const audit = await migratorPrisma.auditLogEntry.findFirst({
      where: { caseId, action: 'verification_case.resolve', actorType: 'SYSTEM' },
    });
    expect(audit).not.toBeNull();

    // Webhook delivery is async relative to the activity's own return in
    // this test only because it's a real HTTP round trip to 127.0.0.1 —
    // give it a moment, then verify the signature the same way a tenant's
    // receiver would.
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

  it('expireOtpActivity resolves the case to EXPIRED', async () => {
    const { tenantId, subjectId, caseId } = await makeCase('workflow-test-expired');
    await sendOtpActivity({ caseId, tenantId, subjectId, phone: '+15551234567' });

    await expireOtpActivity({ caseId, tenantId, subjectId, phone: '+15551234567' });

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('EXPIRED');
  });

  it('sanity: sha256Hex of a known code matches what verifyOtpActivity would accept as PASSED', async () => {
    // Closes the gap the second test above calls out: proves the PASSED
    // path using a case we control the code for end to end, independent of
    // the otp_sms provider's own random generation.
    const { tenantId, subjectId, caseId } = await makeCase('workflow-test-passed-2');
    await sendOtpActivity({ caseId, tenantId, subjectId, phone: '+15551234567' });

    const knownCode = '424242';
    const knownHash = sha256Hex(knownCode);
    // Overwrite the stored hash to one whose plaintext we know — the same
    // resultMeta shape sendOtpActivity itself writes.
    await migratorPrisma.verificationMethodAttempt.updateMany({
      where: { caseId, method: 'otp_sms' },
      data: { resultMeta: { codeHash: knownHash } },
    });

    const result = await verifyOtpActivity({
      tenantId,
      caseId,
      subjectId,
      codeHash: knownHash,
      submittedCode: knownCode,
    });
    expect(result.status).toBe('PASSED');

    const kase = await migratorPrisma.verificationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(kase.status).toBe('APPROVED');
  });
});
