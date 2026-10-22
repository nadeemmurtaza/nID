import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import { loadEnv } from '../config/env';

export type TenantScopedClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor() {
    // Deliberately APP_DATABASE_URL (the nid_app role), never DATABASE_URL —
    // see docs/HOUSE-RULES.md rule 2 and the migration's role comment.
    this.client = createPrismaClient(loadEnv().appDatabaseUrl);
  }

  /**
   * Runs `fn` with `app.tenant_id` set for the duration of one transaction —
   * the only way request-scoped code should touch a tenant-owned table.
   */
  async forTenant<T>(tenantId: string, fn: (tx: TenantScopedClient) => Promise<T>): Promise<T> {
    return withTenantContext(this.client, tenantId, fn);
  }

  /**
   * Direct, unscoped access. Valid against two kinds of table: one with an
   * open-SELECT-for-bootstrap RLS policy — TenantApiKey, VerificationSession,
   * OAuthClient, OAuthLoginRequest, all documented where their migration
   * creates them — or one that carries no tenantId and has no tenant RLS
   * policy at all, because it isn't tenant-owned data: Account,
   * AccountOtpCode, AccountSession (see schema.prisma's comment on that
   * section). Every tenant-owned table's FORCE ROW LEVEL SECURITY policy
   * will return zero rows here for anything else, by design.
   */
  get unscoped(): PrismaClient {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
