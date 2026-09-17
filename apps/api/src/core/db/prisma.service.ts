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
   * Direct, unscoped access. Only valid against a table with an RLS policy
   * that doesn't require tenant context — today, just TenantApiKey's
   * open-SELECT auth-bootstrap policy (apps/api/src/core/auth/api-key.guard.ts).
   * Every tenant-owned table's FORCE ROW LEVEL SECURITY policy will return
   * zero rows here, by design.
   */
  get unscoped(): PrismaClient {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
