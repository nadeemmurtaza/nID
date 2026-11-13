/**
 * Live-Postgres coverage for AccountsService — "Login with nID"'s own
 * signup+login primitive had none until now (unlike every later feature in
 * this codebase, it shipped validated only by a one-off manual curl pass,
 * never as a regression test). Same RUN_DB_TESTS gating and
 * PrismaService-direct-instantiation approach as
 * apps/workflows/test/verification-method.activity.spec.ts calling its
 * activities directly against real Postgres — no HTTP layer, no Nest DI
 * bootstrap, just the real service against the real database.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { sha256Hex } from '@nid/shared-types';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { PrismaService } from '../src/core/db/prisma.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('AccountsService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let accounts: AccountsService;
  const testPhones: string[] = [];

  beforeAll(() => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    accounts = new AccountsService(prismaService);
  });

  afterAll(async () => {
    // Account/AccountOtpCode/AccountSession carry no tenantId and have no
    // tenant RLS policy at all (see PrismaService.unscoped's own comment) —
    // real cleanup, not a mock reset, same as otp_sms's own activity test
    // cleaning up real rows it created.
    await migratorPrisma.accountSession.deleteMany({
      where: { account: { phone: { in: testPhones } } },
    });
    await migratorPrisma.accountOtpCode.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.account.deleteMany({ where: { phone: { in: testPhones } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  function uniquePhone(label: string): string {
    const phone = `+1555${label}${Date.now().toString().slice(-4)}`;
    testPhones.push(phone);
    return phone;
  }

  /** Mirrors otp_sms's own activity test: overwrite the persisted hash to one whose plaintext this test knows, rather than scraping the dev-mode log line. */
  async function overwriteOtpCode(phone: string, knownCode: string): Promise<void> {
    await migratorPrisma.accountOtpCode.updateMany({
      where: { phone },
      data: { codeHash: sha256Hex(knownCode) },
    });
  }

  async function overwriteEmailCode(accountId: string, knownCode: string): Promise<void> {
    await migratorPrisma.accountEmailOtpCode.updateMany({
      where: { accountId },
      data: { codeHash: sha256Hex(knownCode) },
    });
  }

  async function makeAccount(phoneLabel: string): Promise<{ id: string; phone: string }> {
    const phone = uniquePhone(phoneLabel);
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '987654');
    const { account } = await accounts.verifyOtp(phone, '987654');
    return account;
  }

  function uniqueEmail(label: string): string {
    return `${label}${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  }

  it('startOtp writes a real, hashed, unconsumed challenge for the phone', async () => {
    const phone = uniquePhone('a1');
    await accounts.startOtp(phone);

    const challenge = await migratorPrisma.accountOtpCode.findFirst({ where: { phone } });
    expect(challenge).not.toBeNull();
    expect(challenge!.consumedAt).toBeNull();
    expect(challenge!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws when OTP_SMS_DEV_MODE is off instead of pretending to deliver an SMS', async () => {
    const phone = uniquePhone('a2');
    const original = process.env['OTP_SMS_DEV_MODE'];
    process.env['OTP_SMS_DEV_MODE'] = 'false';
    try {
      await expect(accounts.startOtp(phone)).rejects.toThrow(/no production SMS vendor wired up/);
    } finally {
      process.env['OTP_SMS_DEV_MODE'] = original;
    }
  });

  it('verifying the first-ever correct code both creates the Account and logs it in', async () => {
    const phone = uniquePhone('a3');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '424242');

    const result = await accounts.verifyOtp(phone, '424242');

    expect(result.account.phone).toBe(phone);
    expect(result.account.phoneVerifiedAt).not.toBeNull();
    expect(typeof result.sessionToken).toBe('string');

    const storedSession = await migratorPrisma.accountSession.findUnique({
      where: { tokenHash: sha256Hex(result.sessionToken) },
    });
    expect(storedSession?.accountId).toBe(result.account.id);

    const consumed = await migratorPrisma.accountOtpCode.findFirst({ where: { phone } });
    expect(consumed?.consumedAt).not.toBeNull();
  });

  it('rejects a wrong code without consuming the real one', async () => {
    const phone = uniquePhone('a4');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '111111');

    await expect(accounts.verifyOtp(phone, '000000')).rejects.toThrow(UnauthorizedException);

    const stillPending = await migratorPrisma.accountOtpCode.findFirst({ where: { phone } });
    expect(stillPending?.consumedAt).toBeNull();
  });

  it('rejects the same code a second time — single-use even within the TTL window', async () => {
    const phone = uniquePhone('a5');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '555555');

    await accounts.verifyOtp(phone, '555555');
    await expect(accounts.verifyOtp(phone, '555555')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired code even with the right digits', async () => {
    const phone = uniquePhone('a6');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '999999');
    await migratorPrisma.accountOtpCode.updateMany({
      where: { phone },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(accounts.verifyOtp(phone, '999999')).rejects.toThrow(UnauthorizedException);
  });

  it('a returning phone reuses the same Account instead of creating a duplicate', async () => {
    const phone = uniquePhone('a7');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '111222');
    const first = await accounts.verifyOtp(phone, '111222');

    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '333444');
    const second = await accounts.verifyOtp(phone, '333444');

    expect(second.account.id).toBe(first.account.id);
    const accountRows = await migratorPrisma.account.findMany({ where: { phone } });
    expect(accountRows).toHaveLength(1);
  });

  it('resolveSession returns the real account for a valid token', async () => {
    const phone = uniquePhone('a8');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '246810');
    const { sessionToken, account } = await accounts.verifyOtp(phone, '246810');

    const resolved = await accounts.resolveSession(sessionToken);
    expect(resolved.id).toBe(account.id);
  });

  it('resolveSession rejects an unknown token', async () => {
    await expect(accounts.resolveSession('not-a-real-token')).rejects.toThrow(UnauthorizedException);
  });

  it('resolveSession rejects an expired session', async () => {
    const phone = uniquePhone('a9');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '135790');
    const { sessionToken } = await accounts.verifyOtp(phone, '135790');

    await migratorPrisma.accountSession.updateMany({
      where: { tokenHash: sha256Hex(sessionToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(accounts.resolveSession(sessionToken)).rejects.toThrow(UnauthorizedException);
  });

  it('locks a code out after 5 wrong guesses, closing the unthrottled brute-force path', async () => {
    const phone = uniquePhone('b1');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '424242');

    for (let i = 0; i < 5; i++) {
      await expect(accounts.verifyOtp(phone, '000000')).rejects.toThrow(UnauthorizedException);
    }
    // The 6th call is the real code, but the code is already locked — even the correct code is now rejected.
    await expect(accounts.verifyOtp(phone, '424242')).rejects.toThrow(/Too many incorrect attempts/);

    const locked = await migratorPrisma.accountOtpCode.findFirst({ where: { phone } });
    expect(locked?.consumedAt).not.toBeNull();
  });

  it('enforces a resend cooldown while a code is outstanding, but not after a successful login', async () => {
    const phone = uniquePhone('b2');
    await accounts.startOtp(phone);
    await expect(accounts.startOtp(phone)).rejects.toThrow(/wait before requesting/);

    await overwriteOtpCode(phone, '424242');
    await accounts.verifyOtp(phone, '424242');
    await expect(accounts.startOtp(phone)).resolves.toBeUndefined();
  });

  it('logout revokes only the session presented', async () => {
    const phone = uniquePhone('b3');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '111111');
    const first = await accounts.verifyOtp(phone, '111111');

    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '222222');
    const second = await accounts.verifyOtp(phone, '222222');

    await accounts.revokeSession(sha256Hex(first.sessionToken));

    await expect(accounts.resolveSession(first.sessionToken)).rejects.toThrow(UnauthorizedException);
    await expect(accounts.resolveSession(second.sessionToken)).resolves.toMatchObject({ id: second.account.id });
  });

  it('logout-all revokes every session for the account — the only recovery path for a leaked/guessed token', async () => {
    const phone = uniquePhone('b4');
    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '333333');
    const first = await accounts.verifyOtp(phone, '333333');

    await accounts.startOtp(phone);
    await overwriteOtpCode(phone, '444444');
    const second = await accounts.verifyOtp(phone, '444444');

    await accounts.revokeAllSessions(first.account.id);

    await expect(accounts.resolveSession(first.sessionToken)).rejects.toThrow(UnauthorizedException);
    await expect(accounts.resolveSession(second.sessionToken)).rejects.toThrow(UnauthorizedException);
  });

  it('verifies an email address with the correct code and sets emailVerifiedAt', async () => {
    const account = await makeAccount('c1');
    const email = uniqueEmail('c1');

    await accounts.startEmailVerification(account.id, email);
    await overwriteEmailCode(account.id, '135790');
    const updated = await accounts.verifyEmail(account.id, '135790');

    expect(updated.email).toBe(email);
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it('locks an email code out after 5 wrong guesses, same brute-force protection as phone OTP', async () => {
    const account = await makeAccount('c2');
    await accounts.startEmailVerification(account.id, uniqueEmail('c2'));
    await overwriteEmailCode(account.id, '424242');

    for (let i = 0; i < 5; i++) {
      await expect(accounts.verifyEmail(account.id, '000000')).rejects.toThrow(UnauthorizedException);
    }
    await expect(accounts.verifyEmail(account.id, '424242')).rejects.toThrow(/Too many incorrect attempts/);
  });

  it('enforces a resend cooldown while an email code is outstanding', async () => {
    const account = await makeAccount('c3');
    await accounts.startEmailVerification(account.id, uniqueEmail('c3'));
    await expect(accounts.startEmailVerification(account.id, uniqueEmail('c3b'))).rejects.toThrow(/wait before requesting/);
  });

  it('rejects verifying an email already verified on a different account — checked at verify time, never at start time', async () => {
    const claimed = uniqueEmail('c4-claimed');
    const ownerAccount = await makeAccount('c4owner');
    await accounts.startEmailVerification(ownerAccount.id, claimed);
    await overwriteEmailCode(ownerAccount.id, '111222');
    await accounts.verifyEmail(ownerAccount.id, '111222');

    const otherAccount = await makeAccount('c4other');
    // start() never checks uniqueness — it must not leak whether an email
    // is already registered to someone who hasn't proven they control it.
    await expect(accounts.startEmailVerification(otherAccount.id, claimed)).resolves.toBeUndefined();
    await overwriteEmailCode(otherAccount.id, '333444');
    await expect(accounts.verifyEmail(otherAccount.id, '333444')).rejects.toThrow(BadRequestException);
  });
});
