import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { sha256Hex } from '@nid/shared-types';
import { PrismaService } from '../../core/db/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { TemporalClientService } from '../../core/temporal/temporal-client.service';

/**
 * The subject-facing half of a verification case — resolved by
 * VerificationSession token instead of a tenant API key, exactly the way
 * ApiKeyGuard resolves TenantApiKey before app.tenant_id is set. See
 * VerificationSession's schema comment and the migration's RLS policy.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly temporal: TemporalClientService,
  ) {}

  private async resolve(token: string) {
    const tokenHash = sha256Hex(token);
    const session = await this.prisma.unscoped.verificationSession.findUnique({ where: { tokenHash } });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('This verification link is invalid or has expired.');
    }
    return session;
  }

  async getStatus(token: string) {
    const session = await this.resolve(token);

    return this.prisma.forTenant(session.tenantId, async (tx) => {
      const kase = await tx.verificationCase.findUniqueOrThrow({
        where: { id: session.caseId },
        include: { attempts: true, subject: { select: { phone: true } } },
      });

      await this.audit.record(tx, session.tenantId, {
        actorType: 'SUBJECT',
        action: 'verification_case.read',
        subjectId: kase.subjectId,
        caseId: kase.id,
      });

      return {
        status: kase.status,
        method: kase.attempts[0]?.method ?? null,
        phone: kase.subject.phone,
      };
    });
  }

  async submitOtp(token: string, code: string): Promise<{ accepted: true }> {
    const session = await this.resolve(token);

    const kase = await this.prisma.forTenant(session.tenantId, async (tx) => {
      const found = await tx.verificationCase.findUniqueOrThrow({ where: { id: session.caseId } });
      if (!found.temporalWorkflowId) {
        throw new BadRequestException('This verification is no longer accepting a code.');
      }
      await this.audit.record(tx, session.tenantId, {
        actorType: 'SUBJECT',
        action: 'verification_case.submit_otp',
        subjectId: found.subjectId,
        caseId: found.id,
      });
      return found;
    });

    await this.temporal.submitOtpCode(kase.temporalWorkflowId as string, code);
    return { accepted: true };
  }
}
