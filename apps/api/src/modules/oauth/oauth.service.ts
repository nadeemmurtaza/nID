import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { constantTimeEqualHex, generateSessionToken, sha256Hex } from '@nid/shared-types';
import type { Account } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';

const LOGIN_REQUEST_TTL_MINUTES = 10;

export interface LoginRequestStatusView {
  status: 'PENDING' | 'APPROVED' | 'EXPIRED';
  clientName: string;
}

/**
 * "Login with nID" — the flow a relying-party app's "Continue with nID"
 * button drives. Deliberately not full OAuth2/OIDC (no PKCE, no signed JWT
 * ID tokens, no discovery document): a redirect carries a one-time code,
 * the RP's own backend exchanges it server-side with its client secret for
 * identity claims. Interoperable enough for a Phase-0-scale integration
 * without building a general-purpose OAuth server.
 *
 * apps/login-ui delivers the SAME approval link (`/authorize/:pollToken`)
 * two ways — a clickable URL for a same-device login, a QR code of that
 * same URL for a cross-device one. That split matters for who does what:
 * approve() is called by whichever device just authenticated (the phone,
 * on a QR scan); claim() is called by whichever tab has been polling since
 * the link was first opened (the desktop tab that showed the QR) — that's
 * always the tab actually driving the RP's browser flow, so it's the one
 * that has to perform the final redirect, not the approving device. In the
 * same-device case both roles are the same tab, and it just calls both in
 * sequence. See OAuthLoginRequest's schema comment.
 */
@Injectable()
export class OAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createLoginRequest(
    clientId: string,
    redirectUri: string,
    state: string | undefined,
  ): Promise<{ pollToken: string; expiresAt: Date }> {
    const client = await this.prisma.unscoped.oAuthClient.findUnique({ where: { clientId } });
    if (!client) {
      throw new NotFoundException('Unknown client.');
    }
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('That redirect URI is not registered for this client.');
    }

    const poll = generateSessionToken();
    const expiresAt = new Date(Date.now() + LOGIN_REQUEST_TTL_MINUTES * 60_000);

    await this.prisma.forTenant(client.tenantId, (tx) =>
      tx.oAuthLoginRequest.create({
        data: {
          tenantId: client.tenantId,
          clientId: client.id,
          redirectUri,
          state,
          pollTokenHash: poll.hash,
          expiresAt,
        },
      }),
    );

    return { pollToken: poll.plaintext, expiresAt };
  }

  async getStatus(pollToken: string): Promise<LoginRequestStatusView> {
    const request = await this.findByPollToken(pollToken);
    return { status: this.effectiveStatus(request), clientName: request.client.name };
  }

  /** Called by whichever device just authenticated. Does not mint the redirect code — see claim(). */
  async approve(pollToken: string, account: Account): Promise<{ approved: true }> {
    const request = await this.findByPollToken(pollToken);

    if (this.effectiveStatus(request) !== 'PENDING') {
      throw new BadRequestException('This login request is no longer pending.');
    }

    await this.prisma.forTenant(request.tenantId, (tx) =>
      tx.oAuthLoginRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', accountId: account.id },
      }),
    );
    return { approved: true };
  }

  /**
   * Called by the polling tab once it observes APPROVED — mints the
   * one-time code and hands it back exactly once (codeHash being already
   * set is what makes a second claim on the same request fail), so it's
   * always the polling tab that redirects, never the approving device.
   * Unauthenticated: gated by knowing pollToken, same as getStatus().
   */
  async claim(pollToken: string): Promise<{ redirectUri: string; code: string; state: string | null }> {
    const request = await this.findByPollToken(pollToken);

    if (this.effectiveStatus(request) !== 'APPROVED') {
      throw new BadRequestException('This login request has not been approved yet.');
    }
    if (request.codeHash !== null) {
      throw new BadRequestException('This login request has already been claimed.');
    }

    const code = generateSessionToken();
    await this.prisma.forTenant(request.tenantId, (tx) =>
      tx.oAuthLoginRequest.update({ where: { id: request.id }, data: { codeHash: code.hash } }),
    );

    return { redirectUri: request.redirectUri, code: code.plaintext, state: request.state };
  }

  async exchangeToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{ account: Pick<Account, 'id' | 'phone' | 'email' | 'phoneVerifiedAt'> }> {
    const client = await this.prisma.unscoped.oAuthClient.findUnique({ where: { clientId } });
    if (!client || !constantTimeEqualHex(sha256Hex(clientSecret), client.clientSecretHash)) {
      throw new ForbiddenException('Invalid client credentials.');
    }

    const codeHash = sha256Hex(code);
    const request = await this.prisma.unscoped.oAuthLoginRequest.findUnique({ where: { codeHash } });

    if (
      !request ||
      request.clientId !== client.id ||
      request.redirectUri !== redirectUri ||
      request.codeConsumedAt !== null ||
      request.expiresAt.getTime() < Date.now() ||
      !request.accountId
    ) {
      throw new ForbiddenException('Invalid or already-used code.');
    }

    // One-time: mark the code consumed before handing back the claims it
    // unlocks, so a retried/duplicated exchange call can't succeed twice.
    await this.prisma.forTenant(request.tenantId, (tx) =>
      tx.oAuthLoginRequest.update({ where: { id: request.id }, data: { codeConsumedAt: new Date() } }),
    );
    const account = await this.prisma.unscoped.account.findUniqueOrThrow({
      where: { id: request.accountId },
    });

    return {
      account: {
        id: account.id,
        phone: account.phone,
        email: account.email,
        phoneVerifiedAt: account.phoneVerifiedAt,
      },
    };
  }

  private async findByPollToken(pollToken: string) {
    const pollTokenHash = sha256Hex(pollToken);
    const request = await this.prisma.unscoped.oAuthLoginRequest.findUnique({
      where: { pollTokenHash },
      include: { client: { select: { name: true } } },
    });
    if (!request) {
      throw new NotFoundException('This login link is invalid or has expired.');
    }
    return request;
  }

  private effectiveStatus(request: { status: string; expiresAt: Date }): 'PENDING' | 'APPROVED' | 'EXPIRED' {
    if (request.status === 'PENDING' && request.expiresAt.getTime() < Date.now()) {
      return 'EXPIRED';
    }
    return request.status as 'PENDING' | 'APPROVED' | 'EXPIRED';
  }
}
