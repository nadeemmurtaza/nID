import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { hashApiKey } from '@nid/shared-types';
import { PrismaService } from '../db/prisma.service';
import type { AuthenticatedTenant } from './types';

/**
 * Resolves the calling tenant from `Authorization: Bearer <key>`. This is
 * the one place a request crosses from "no tenant context" to "known
 * tenant" — the lookup itself relies on TenantApiKey's open-SELECT RLS
 * policy (see the migration), since app.tenant_id can't be set before the
 * tenant is known. Every controller behind this guard must read
 * `request.tenant` rather than trust anything the client sent as a tenant id.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: AuthenticatedTenant }>();
    const header = request.headers['authorization'];

    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    const plaintext = header.slice('Bearer '.length).trim();
    if (plaintext.length === 0) {
      throw new UnauthorizedException('Missing API key.');
    }

    const keyHash = hashApiKey(plaintext);
    const apiKey = await this.prisma.unscoped.tenantApiKey.findUnique({ where: { keyHash } });

    if (!apiKey || apiKey.revokedAt !== null) {
      throw new UnauthorizedException('Invalid or revoked API key.');
    }

    request.tenant = {
      tenantId: apiKey.tenantId,
      apiKeyId: apiKey.id,
      scopes: apiKey.scopes,
    };
    return true;
  }
}
