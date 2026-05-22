import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env from the root directory to ensure variables are available
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const redisConfig: any = {
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    reconnectStrategy: (retries: number) => {
      if (retries > 10) return new Error('Max retries reached');
      return Math.min(retries * 50, 1000);
    }
  },
  username: process.env.REDIS_USER || 'default',
  password: process.env.REDIS_PASS,
};

console.log(`[Redis] Attempting to connect to: ${redisConfig.socket.host}:${redisConfig.socket.port}`);

export const redisClient = createClient(redisConfig);

redisClient.on('error', (err) => console.error('[Redis] Client error', err));

export async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('[Redis] Connected Successfully to Cloud Redis Labs');
    }
  } catch (error) {
    console.error('[Redis] Connection failed:', error);
  }
}
