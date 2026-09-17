import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Account } from '@nid/db';
import { AccountsService } from '../../modules/accounts/accounts.service';

/**
 * Resolves the calling Account from `Authorization: Bearer <sessionToken>`
 * — the account-identity equivalent of ApiKeyGuard, for routes a person
 * (not a tenant's API key) calls directly: GET /v1/accounts/me, and
 * approving an OAuthLoginRequest.
 */
@Injectable()
export class AccountSessionGuard implements CanActivate {
  constructor(private readonly accounts: AccountsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { account?: Account }>();
    const header = request.headers['authorization'];

    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedException('Missing session token.');
    }

    request.account = await this.accounts.resolveSession(token);
    return true;
  }
}
