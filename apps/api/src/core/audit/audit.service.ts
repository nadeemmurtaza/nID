import { Injectable } from '@nestjs/common';
import type { TenantScopedClient } from '../db/prisma.service';

export interface AuditEntryInput {
  actorType: 'TENANT_STAFF' | 'SUBJECT' | 'SYSTEM' | 'API_KEY';
  actorId?: string;
  action: string;
  subjectId?: string;
  caseId?: string;
  ipAddress?: string;
}

/**
 * Writes an AuditLogEntry inside the caller's tenant-scoped transaction, so
 * the audit row and the operation it describes commit together. Called on
 * every read of Subject/Organization/Attempt/DocumentAsset PII, not just on
 * writes — docs/HOUSE-RULES.md rule 3.
 */
@Injectable()
export class AuditService {
  async record(tx: TenantScopedClient, tenantId: string, entry: AuditEntryInput): Promise<void> {
    await tx.auditLogEntry.create({
      data: {
        tenantId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        subjectId: entry.subjectId,
        caseId: entry.caseId,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
