import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Connection, WorkflowClient } from '@temporalio/client';
import {
  VERIFICATION_WORKFLOW_TYPE,
  submitMethodPayloadSignal,
  verificationStatusQuery,
  type VerificationWorkflowInput,
  type VerificationOutcome,
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

  async startVerification(workflowId: string, input: VerificationWorkflowInput): Promise<void> {
    const client = await this.getClient();
    await client.start(VERIFICATION_WORKFLOW_TYPE, {
      workflowId,
      taskQueue: process.env['TEMPORAL_TASK_QUEUE'] ?? 'nid-verification',
      args: [input],
    });
  }

  /** Forwards whatever the subject just submitted for the method the workflow is currently waiting on. */
  async submitMethodPayload(workflowId: string, method: string, payload: Record<string, unknown>): Promise<void> {
    const client = await this.getClient();
    await client.getHandle(workflowId).signal(submitMethodPayloadSignal, { method, payload });
  }

  async getVerificationStatus(workflowId: string): Promise<VerificationOutcome> {
    const client = await this.getClient();
    return client.getHandle(workflowId).query(verificationStatusQuery);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectionPromise) {
      const connection = await this.connectionPromise;
      await connection.close();
    }
  }
}
