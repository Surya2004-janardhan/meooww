import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { listProviders } from '../lib/providers';

const router = Router();

// GET /api/ai/providers — return providers and configured status
router.get('/providers', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const providers = listProviders();
    res.json({ providers });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

export default router;
