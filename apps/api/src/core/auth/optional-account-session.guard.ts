import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Account } from '@nid/db';
import { AccountsService } from '../../modules/accounts/accounts.service';

/**
 * The public profile read route (GET /v1/profiles/:slug) must stay
 * reachable by anonymous visitors — but a logged-in viewer's identity is
 * exactly what ProfilesService needs to know whether a ProfileFieldGrant
 * applies to them. Same Bearer-token resolution as AccountSessionGuard,
 * except a missing, malformed, invalid or expired token is never an
 * error here — it just means "anonymous viewer", the same outcome as no
 * Authorization header at all.
 */
@Injectable()
export class OptionalAccountSessionGuard implements CanActivate {
  constructor(private readonly accounts: AccountsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { account?: Account }>();
    const header = request.headers['authorization'];

    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      return true;
    }
    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      return true;
    }

    try {
      request.account = await this.accounts.resolveSession(token);
    } catch {
      // Invalid/expired token on a public route — treat as anonymous, not an error.
    }
    return true;
  }
}
