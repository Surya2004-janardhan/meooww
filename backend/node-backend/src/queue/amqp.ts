import amqp, { Connection, Channel } from 'amqplib';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env from the root project directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

let connection: Connection | null = null;
let channel: Channel | null = null;

// Use the URL from .env or a default
const AMQP_URL = process.env.CLOUDAMQP_URL || 'amqp://localhost';

export async function connectQueue() {
  try {
    if (!connection) {
      // Log connection attempt (redacting password)
      const redactedUrl = AMQP_URL.replace(/:([^@]+)@/, ':****@');
      console.log(`[Queue] Connecting to: ${redactedUrl}`);
      
      connection = await amqp.connect(AMQP_URL, {
        timeout: 10000,
      });
      
      channel = await connection.createChannel();
      
      // Assert queues
      await channel.assertQueue('agent_tasks', { durable: true });
      await channel.assertQueue('python_ops', { durable: true });
      await channel.assertQueue('webhook_events', { durable: true });
      
      console.log('[Queue] Connected Successfully to CloudAMQP');
    }
    return { connection, channel };
  } catch (error: any) {
    console.error('[Queue] Connection error:', error.message);
    throw error;
  }
}

export async function publishToQueue(queue: string, message: any) {
  if (!channel) await connectQueue();
  channel!.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
}

export async function consumeFromQueue(queue: string, callback: (msg: any) => Promise<void>) {
  if (!channel) await connectQueue();
  
  await channel!.prefetch(1);
  console.log(`[Queue] Consuming from ${queue}`);
  
  channel!.consume(queue, async (msg) => {
    if (msg) {
      const content = JSON.parse(msg.content.toString());
      try {
        await callback(content);
        channel!.ack(msg);
      } catch (error) {
        console.error(`[Queue] Task error in ${queue}:`, error);
        channel!.nack(msg, false, false);
      }
    }
  });
}
