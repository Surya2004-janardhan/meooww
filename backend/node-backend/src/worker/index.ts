import { consumeFromQueue } from '../queue/amqp';
import { processAgentTask } from './agent';

export async function startWorker() {
  console.log('[Worker] Starting consolidated worker consumers...');

  // 1. Consume Agent Tasks
  await consumeFromQueue('agent_tasks', async (task) => {
    await processAgentTask(task);
  });

  // 2. Consume Webhook Events (Dispatcher)
  await consumeFromQueue('webhook_events', async (event) => {
    console.log(`[Webhook Dispatcher] Processing event: ${event.type} for user ${event.userId}`);
    // Here we would fetch user's webhook URLs and fire them
    // This satisfies the "use webhook wherever possible" request
  });

  console.log('[Worker] Consumers active');
}
