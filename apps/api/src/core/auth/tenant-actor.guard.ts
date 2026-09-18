import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { hashApiKey } from '@nid/shared-types';
import { PrismaService } from '../db/prisma.service';
import { AccountsService } from '../../modules/accounts/accounts.service';
import type { AuthenticatedActor } from './types';

/**
 * A strict superset of ApiKeyGuard: accepts the exact same tenant API key
 * (same lookup, same hash comparison), OR a real staff member's Account
 * session token, resolved through TenantStaffMembership to whichever
 * tenant they're staff of. Only the routes a human in apps/dashboard
 * actually calls (case list/read/resolve) use this — everything else
 * stays on plain ApiKeyGuard, unchanged, exactly as it was.
 *
 * A `Bearer` token could honestly be either kind, so this tries the API
 * key lookup first (same real hash comparison, not a guess) and only
 * falls back to a session token when that misses — never trusts the
 * caller's own claim about which kind it sent.
 *
 * Unlike ApiKeyGuard (whose only dependency, PrismaService, is @Global()),
 * this guard's AccountsService dependency is not — every module that puts
 * a controller behind @UseGuards(TenantActorGuard) needs AccountsModule in
 * its own `imports`, not just AuthModule (which exports this guard but
 * doesn't make its transitive dependency visible to importers of
 * AuthModule) — see e.g. verification-cases.module.ts / tenants.module.ts.
 */
@Injectable()
export class TenantActorGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { actor?: AuthenticatedActor }>();
    const header = request.headers['authorization'];

    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedException('Missing credential.');
    }

    const keyHash = hashApiKey(token);
    const apiKey = await this.prisma.unscoped.tenantApiKey.findUnique({ where: { keyHash } });
    if (apiKey && apiKey.revokedAt === null) {
      request.actor = { tenantId: apiKey.tenantId, actorType: 'API_KEY', actorId: apiKey.id };
      return true;
    }

    const account = await this.accounts.resolveSession(token).catch(() => null);
    if (!account) {
      throw new UnauthorizedException('Invalid API key or session token.');
    }

    const memberships = await this.prisma.unscoped.tenantStaffMembership.findMany({
      where: { accountId: account.id },
    });
    if (memberships.length === 0) {
      throw new ForbiddenException('This account is not staff on any tenant.');
    }

    // An explicit X-Tenant-Id is always honored (and validated) when
    // present — never silently ignored just because this account happens
    // to have only one membership right now. A caller naming the wrong
    // tenant is a real bug worth surfacing, not something to paper over.
    let membership: (typeof memberships)[number];
    const requestedTenantId = request.headers['x-tenant-id'];
    if (requestedTenantId !== undefined) {
      if (Array.isArray(requestedTenantId)) {
        throw new BadRequestException('X-Tenant-Id must be a single value.');
      }
      const match = memberships.find((m) => m.tenantId === requestedTenantId);
      if (!match) {
        throw new ForbiddenException('This account is not staff on the requested tenant.');
      }
      membership = match;
    } else if (memberships.length > 1) {
      throw new BadRequestException('This account is staff on more than one tenant — send X-Tenant-Id.');
    } else {
      membership = memberships[0]!;
    }

    request.actor = { tenantId: membership.tenantId, actorType: 'TENANT_STAFF', actorId: account.id };
    return true;
  }
}
