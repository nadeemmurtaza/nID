import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { generateSessionToken, sha256Hex } from '@nid/shared-types';
import type { Account } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { loadEnv } from '../../core/config/env';

const OTP_CODE_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;
/** Wrong guesses allowed against one code before it's locked and a fresh one is required. */
const MAX_OTP_ATTEMPTS = 5;
/** Minimum gap between two startOtp() calls for the same phone — bounds how many live codes (and therefore how many total guesses) an attacker can accumulate. */
const OTP_RESEND_COOLDOWN_SECONDS = 30;

/**
 * nID's own account system — a portable identity a person creates once
 * (phone + OTP, passwordless) and reuses everywhere, distinct from Subject
 * (owned by one tenant for that tenant's own KYC purposes). "Sign up" and
 * "log in" are the same operation: verifying the first-ever OTP for a phone
 * number creates the Account.
 *
 * Reuses generateSessionToken/sha256Hex from @nid/shared-types — the same
 * primitives VerificationSession and TenantApiKey already use — rather than
 * inventing a parallel token scheme.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startOtp(phone: string): Promise<void> {
    // Cooldown only while a code is still outstanding (unconsumed) — an
    // active guessing attempt keeps consumedAt null, so this blocks an
    // attacker from stacking up more live, guessable codes; a genuine
    // successful login (which consumes its code) can always request the
    // next one immediately.
    const outstanding = await this.prisma.unscoped.accountOtpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (outstanding && Date.now() - outstanding.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new BadRequestException('Please wait before requesting another code.');
    }

    const code = randomInt(0, 10 ** OTP_CODE_LENGTH).toString().padStart(OTP_CODE_LENGTH, '0');
    const codeHash = sha256Hex(code);

    await this.prisma.unscoped.accountOtpCode.create({
      data: { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) },
    });

    const env = loadEnv();
    if (!env.otpSmsDevMode) {
      throw new Error('Account OTP delivery has no production SMS vendor wired up yet — set OTP_SMS_DEV_MODE=true for local/dev use.');
    }
    // Dev-only: logs instead of sending, same convention as
    // packages/verification-providers' otp_sms provider.
    this.logger.log(`[accounts:dev] would send login code ${code} to ${phone}`);
  }

  async verifyOtp(phone: string, code: string): Promise<{ sessionToken: string; account: Account }> {
    // Looked up by phone alone (not phone+codeHash) so a WRONG guess still
    // finds the live challenge to count against it — otherwise a mismatch
    // would silently no-op instead of consuming an attempt, and the code
    // stays guessable, unthrottled, for its whole 10-minute TTL.
    const challenge = await this.prisma.unscoped.accountOtpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException('That code is incorrect or has expired.');
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      await this.prisma.unscoped.accountOtpCode.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new UnauthorizedException('Too many incorrect attempts. Request a new code.');
    }

    if (sha256Hex(code) !== challenge.codeHash) {
      await this.prisma.unscoped.accountOtpCode.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('That code is incorrect or has expired.');
    }

    // Codes are single-use even if guessed twice in the TTL window.
    await this.prisma.unscoped.accountOtpCode.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const account = await this.prisma.unscoped.account.upsert({
      where: { phone },
      update: { phoneVerifiedAt: new Date() },
      create: { phone, phoneVerifiedAt: new Date() },
    });

    const session = generateSessionToken();
    await this.prisma.unscoped.accountSession.create({
      data: {
        accountId: account.id,
        tokenHash: session.hash,
        expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
      },
    });

    return { sessionToken: session.plaintext, account };
  }

  async resolveSession(token: string): Promise<Account> {
    const tokenHash = sha256Hex(token);
    const session = await this.prisma.unscoped.accountSession.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    return session.account;
  }

  /** Logs out the one session presented — e.g. a "log out this device" action. */
  async revokeSession(tokenHash: string): Promise<void> {
    await this.prisma.unscoped.accountSession.deleteMany({ where: { tokenHash } });
  }

  /**
   * Logs out every session for this Account — the only remediation a user
   * has if a session token may have leaked or been guessed (there was
   * previously no way to invalidate a session short of its natural
   * 30-day expiry).
   */
  async revokeAllSessions(accountId: string): Promise<void> {
    await this.prisma.unscoped.accountSession.deleteMany({ where: { accountId } });
  }
}
