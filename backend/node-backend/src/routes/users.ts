import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

// GET /api/users/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, avatar: true, bio: true, provider: true, createdAt: true, updatedAt: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

// PATCH /api/users/profile
router.patch('/profile', authenticate, validate(UpdateProfileSchema), async (req: AuthRequest, res: Response) => {
  const { name, bio, avatar } = req.body as z.infer<typeof UpdateProfileSchema>;
  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: { name, bio, avatar },
    select: { id: true, email: true, name: true, avatar: true, bio: true, provider: true, createdAt: true, updatedAt: true },
  });
  res.json(user);
});

// DELETE /api/users/profile
router.delete('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.user.delete({ where: { id: req.user!.sub } });
  res
    .clearCookie('refresh_token')
    .clearCookie('access_token')
    .json({ message: 'Account deleted' });
});

export default router;
