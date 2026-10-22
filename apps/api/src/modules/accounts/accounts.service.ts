import { randomInt } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { generateSessionToken, sha256Hex } from '@nid/shared-types';
import type { Account } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';
import { loadEnv } from '../../core/config/env';

const OTP_CODE_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;

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
    const codeHash = sha256Hex(code);
    const challenge = await this.prisma.unscoped.accountOtpCode.findFirst({
      where: { phone, codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
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
}
