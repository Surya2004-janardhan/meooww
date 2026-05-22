import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import passport from './lib/passport';
import { connectRedis } from './lib/redis';
import { generalLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import agentRoutes from './routes/agents';
import workflowRoutes from './routes/workflows';
import runRoutes from './routes/runs';
import paymentRoutes from './routes/payments';
import aiRoutes from './routes/ai';
import knowledgeBaseRoutes from './routes/knowledge-base';
import logsRoutes from './routes/logs';
import toolsRoutes from './routes/tools';
import webhooksRoutes from './routes/webhooks';
import credentialRoutes from './routes/credentials';
import userAIConfigRoutes from './routes/user-ai-config';

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(passport.initialize());

// Stripe webhook needs the raw body before express.json()
app.use('/api/payments/webhook', express.raw({ type: '*/*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/kb', knowledgeBaseRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/user/ai-config', userAIConfigRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

import { connectQueue } from './queue/amqp';
import { startWorker } from './worker';

async function bootstrap() {
  await connectRedis();
  
  try {
    await connectQueue();
    await startWorker();
  } catch (error) {
    console.error('[Queue/Worker] Initial connection failed, but API is running. Retrying in background...', error);
  }
  
  app.listen(PORT, () => {
    console.log(`[node-backend] listening on :${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[node-api] failed to start', err);
  process.exit(1);
});
