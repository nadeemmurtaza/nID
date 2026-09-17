import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/verification-method.activity';

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env['TEMPORAL_NAMESPACE'] ?? 'default',
    taskQueue: process.env['TEMPORAL_TASK_QUEUE'] ?? 'nid-verification',
    workflowsPath: require.resolve('./workflows/verification.workflow'),
    activities,
  });

  // eslint-disable-next-line no-console
  console.log('nID Temporal worker started');
  await worker.run();
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
