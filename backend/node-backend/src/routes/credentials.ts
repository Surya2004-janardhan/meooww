import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const MockCredentialSchema = z.object({
  provider: z.enum(['instagram', 'youtube']),
  accessToken: z.string().min(1),
  metadata: z.any().optional(),
});

// GET /api/credentials — List user's connected accounts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const credentials = await prisma.userCredential.findMany({
    where: { userId: req.user!.sub },
    select: {
      provider: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({ credentials });
});

// POST /api/credentials/mock — Mock an OAuth connection (for development)
router.post('/mock', authenticate, async (req: AuthRequest, res: Response) => {
  const { provider, accessToken, metadata } = MockCredentialSchema.parse(req.body);
  
  const credential = await prisma.userCredential.upsert({
    where: {
      userId_provider: {
        userId: req.user!.sub,
        provider,
      },
    },
    update: {
      accessToken,
      metadata,
      updatedAt: new Date(),
    },
    create: {
      userId: req.user!.sub,
      provider,
      accessToken,
      metadata,
    },
  });

  res.json({ message: `${provider} connected successfully`, credential });
});

// DELETE /api/credentials/:provider — Disconnect an account
router.delete('/:provider', authenticate, async (req: AuthRequest, res: Response) => {
  const { provider } = req.params;
  
  await prisma.userCredential.deleteMany({
    where: {
      userId: req.user!.sub,
      provider,
    },
  });

  res.status(204).send();
});

export default router;
