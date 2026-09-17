import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, apiKeyId: string, dto: CreateSubjectDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const subject = await tx.subject.create({
        data: {
          tenantId,
          type: dto.type,
          externalRef: dto.externalRef,
          givenName: dto.givenName,
          familyName: dto.familyName,
          email: dto.email,
          phone: dto.phone,
        },
      });
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.create',
        subjectId: subject.id,
      });
      return subject;
    });
  }

  async getById(tenantId: string, apiKeyId: string, subjectId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Deliberately no `where: { tenantId }` — RLS is what must stop this
      // from returning another tenant's Subject, per docs/HOUSE-RULES.md rule 2.
      const subject = await tx.subject.findUnique({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found.');
      }
      await this.audit.record(tx, tenantId, {
        actorType: 'API_KEY',
        actorId: apiKeyId,
        action: 'subject.read',
        subjectId: subject.id,
      });
      return subject;
    });
  }
}
