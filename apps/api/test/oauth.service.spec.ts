/**
 * Live-Postgres coverage for OAuthService — "Login with nID"'s relying-party
 * flow had none until now (see accounts.service.spec.ts's own header
 * comment for why). Exercises the exact sequence a real "Continue with
 * nID" integration runs: create a login request, poll its status, approve
 * it as an authenticated Account, claim the one-time code, exchange it for
 * identity claims — including the security-critical negative paths (wrong
 * client secret, code replay, mismatched redirect URI).
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient, type Account } from '@nid/db';
import { sha256Hex } from '@nid/shared-types';
import { OAuthService } from '../src/modules/oauth/oauth.service';
import { PrismaService } from '../src/core/db/prisma.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

const REDIRECT_URI = 'http://localhost:5000/callback';
const CLIENT_SECRET = 'test-oauth-client-secret';

describeIfDb('OAuthService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let oauth: OAuthService;
  let tenantId: string;
  let clientId: string;
  let account: Account;
  const testTenantIds: string[] = [];

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    oauth = new OAuthService(prismaService);

    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'oauth-service-spec-tenant' },
      update: {},
      create: { name: 'OAuth Service Spec Tenant', slug: 'oauth-service-spec-tenant' },
    });
    tenantId = tenant.id;
    testTenantIds.push(tenantId);

    const client = await migratorPrisma.oAuthClient.create({
      data: {
        tenantId,
        name: 'Spec Test RP',
        clientId: `client_spec_${Date.now()}`,
        clientSecretHash: sha256Hex(CLIENT_SECRET),
        redirectUris: [REDIRECT_URI],
      },
    });
    clientId = client.clientId;

    account = await migratorPrisma.account.create({
      data: { phone: `+15556660000${Date.now().toString().slice(-3)}`, phoneVerifiedAt: new Date() },
    });
  });

  afterAll(async () => {
    await migratorPrisma.oAuthLoginRequest.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.oAuthClient.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
    await migratorPrisma.account.delete({ where: { id: account.id } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  it('rejects a login request for an unknown client', async () => {
    await expect(oauth.createLoginRequest('no-such-client', REDIRECT_URI, undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a login request whose redirectUri is not registered for the client', async () => {
    await expect(
      oauth.createLoginRequest(clientId, 'http://evil.example.test/callback', undefined),
    ).rejects.toThrow(BadRequestException);
  });

  it('the full happy path: create, poll PENDING, approve, poll APPROVED, claim, exchange', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, 'my-state');
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const pending = await oauth.getStatus(created.pollToken);
    expect(pending).toEqual({ status: 'PENDING', clientName: 'Spec Test RP' });

    const approval = await oauth.approve(created.pollToken, account);
    expect(approval).toEqual({ approved: true });

    const approved = await oauth.getStatus(created.pollToken);
    expect(approved.status).toBe('APPROVED');

    const claimed = await oauth.claim(created.pollToken);
    expect(claimed.redirectUri).toBe(REDIRECT_URI);
    expect(claimed.state).toBe('my-state');
    expect(typeof claimed.code).toBe('string');

    const exchanged = await oauth.exchangeToken(claimed.code, clientId, CLIENT_SECRET, REDIRECT_URI);
    expect(exchanged.account.id).toBe(account.id);
    expect(exchanged.account.phone).toBe(account.phone);
  });

  it('rejects approve() on a request that is not pending (already approved)', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);

    await expect(oauth.approve(created.pollToken, account)).rejects.toThrow(BadRequestException);
  });

  it('rejects claim() before approval', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await expect(oauth.claim(created.pollToken)).rejects.toThrow(BadRequestException);
  });

  it('rejects a second claim() on the same request — the code is minted exactly once', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);
    await oauth.claim(created.pollToken);

    await expect(oauth.claim(created.pollToken)).rejects.toThrow(BadRequestException);
  });

  it('exchangeToken rejects the wrong client secret', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);
    const { code } = await oauth.claim(created.pollToken);

    await expect(oauth.exchangeToken(code, clientId, 'wrong-secret', REDIRECT_URI)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('exchangeToken rejects a mismatched redirectUri, even with the right code and secret', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);
    const { code } = await oauth.claim(created.pollToken);

    await expect(
      oauth.exchangeToken(code, clientId, CLIENT_SECRET, 'http://localhost:5000/different-callback'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('exchangeToken rejects replaying an already-consumed code', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);
    const { code } = await oauth.claim(created.pollToken);

    await oauth.exchangeToken(code, clientId, CLIENT_SECRET, REDIRECT_URI);
    await expect(oauth.exchangeToken(code, clientId, CLIENT_SECRET, REDIRECT_URI)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('getStatus/approve/claim reject an unknown pollToken', async () => {
    await expect(oauth.getStatus('not-a-real-poll-token')).rejects.toThrow(NotFoundException);
    await expect(oauth.approve('not-a-real-poll-token', account)).rejects.toThrow(NotFoundException);
    await expect(oauth.claim('not-a-real-poll-token')).rejects.toThrow(NotFoundException);
  });

  it('treats an expired-but-still-PENDING request as EXPIRED, not approvable', async () => {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await migratorPrisma.oAuthLoginRequest.updateMany({
      where: { pollTokenHash: sha256Hex(created.pollToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const status = await oauth.getStatus(created.pollToken);
    expect(status.status).toBe('EXPIRED');
    await expect(oauth.approve(created.pollToken, account)).rejects.toThrow(BadRequestException);
  });
});
