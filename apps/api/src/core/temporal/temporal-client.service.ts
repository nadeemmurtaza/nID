import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Connection, WorkflowClient } from '@temporalio/client';
import {
  OTP_VERIFICATION_WORKFLOW_TYPE,
  submitOtpCodeSignal,
  otpStatusQuery,
  type OtpVerificationWorkflowInput,
  type OtpVerificationOutcome,
} from '@nid/workflow-contracts';

/**
 * Thin wrapper around the Temporal SDK client. Only imports
 * @nid/workflow-contracts (signal/query/workflow-type names) — never
 * apps/workflows' implementation — so the API and the worker can deploy
 * independently. See docs/HOUSE-RULES.md rule 5.
 */
@Injectable()
export class TemporalClientService implements OnModuleDestroy {
  private connectionPromise: Promise<Connection> | null = null;

  private async getClient(): Promise<WorkflowClient> {
    if (!this.connectionPromise) {
      this.connectionPromise = Connection.connect({
        address: process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
      });
    }
    const connection = await this.connectionPromise;
    return new WorkflowClient({
      connection,
      namespace: process.env['TEMPORAL_NAMESPACE'] ?? 'default',
    });
  }

  async startOtpVerification(workflowId: string, input: OtpVerificationWorkflowInput): Promise<void> {
    const client = await this.getClient();
    await client.start(OTP_VERIFICATION_WORKFLOW_TYPE, {
      workflowId,
      taskQueue: process.env['TEMPORAL_TASK_QUEUE'] ?? 'nid-verification',
      args: [input],
    });
  }

  async submitOtpCode(workflowId: string, code: string): Promise<void> {
    const client = await this.getClient();
    await client.getHandle(workflowId).signal(submitOtpCodeSignal, code);
  }

  async getOtpStatus(workflowId: string): Promise<OtpVerificationOutcome> {
    const client = await this.getClient();
    return client.getHandle(workflowId).query(otpStatusQuery);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectionPromise) {
      const connection = await this.connectionPromise;
      await connection.close();
    }
  }
}
