import { Router, Response } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const AI_URL = process.env.AI_WORKER_URL || 'http://localhost:5000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

const aiHeaders = () => ({ 'x-internal-secret': INTERNAL_SECRET });

// GET /api/runs
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const runs = await prisma.run.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ runs });
});

// GET /api/runs/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const run = await prisma.run.findFirst({
    where: { id: req.params.id, userId: req.user!.sub },
  });
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

// POST /api/runs/:id/refresh
router.post('/:id/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  const run = await prisma.run.findFirst({
    where: { id: req.params.id, userId: req.user!.sub },
  });
  if (!run || !run.jobId) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  try {
    const { data } = await axios.get(`${AI_URL}/ai/jobs/${run.jobId}`, { headers: aiHeaders() });
    if (data.status === 'finished') {
      const usage = data.result?.usage || {};
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: data.result?.output || null,
          tokens: usage.total_tokens ?? null,
          cost: usage.cost ?? null,
          completedAt: new Date(),
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.usageDaily.upsert({
        where: { userId_date: { userId: req.user!.sub, date: today } },
        update: {
          requests: { increment: 1 },
          tokens: { increment: usage.total_tokens ?? 0 },
          cost: { increment: usage.cost ?? 0 },
        },
        create: {
          userId: req.user!.sub,
          date: today,
          requests: 1,
          tokens: usage.total_tokens ?? 0,
          cost: usage.cost ?? 0,
        },
      });

      res.json(updated);
      return;
    }

    if (data.status === 'failed') {
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: data.error || 'Execution failed',
          completedAt: new Date(),
        },
      });
      res.json(updated);
      return;
    }

    res.json({ status: data.status });
  } catch (err: any) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.error || 'AI service error' });
  }
});

export default router;
