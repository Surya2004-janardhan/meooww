import { Router, Request, Response, NextFunction } from 'express';
import passport from '../lib/passport';
import { createSession, rotateSession, deleteSession } from '../lib/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const COOKIE_OPTS_REFRESH = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const COOKIE_OPTS_ACCESS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000,
};

/** Shared callback handler — issues cookies and redirects to dashboard. */
async function oauthCallback(req: Request, res: Response) {
  const user = req.user as any;
  const { accessToken, refreshToken } = await createSession(user.id, user.email);
  res
    .cookie('refresh_token', refreshToken, COOKIE_OPTS_REFRESH)
    .cookie('access_token', accessToken, COOKIE_OPTS_ACCESS)
    .redirect(`${FRONTEND_URL}/dashboard`);
}

const failRedirect = `${FRONTEND_URL}/auth/login?error=oauth`;

/** Register initiate + callback routes for an OAuth provider. */
function oauthRoutes(
  provider: string,
  initiateOpts: object,
  callbackOpts: object = {},
) {
  router.get(`/${provider}`, authLimiter, passport.authenticate(provider, { session: false, ...initiateOpts }));
  router.get(
    `/${provider}/callback`,
    passport.authenticate(provider, { session: false, failureRedirect: failRedirect, ...callbackOpts }),
    oauthCallback,
  );
}

// ─── 8 OAuth Providers ────────────────────────────────────────
oauthRoutes('google',    { scope: ['profile', 'email'] });
oauthRoutes('github',    { scope: ['user:email'] });
oauthRoutes('discord',   { scope: ['identify', 'email'] });
oauthRoutes('linkedin',  { scope: ['r_emailaddress', 'r_liteprofile'] });
oauthRoutes('microsoft', { scope: ['user.read'] });
oauthRoutes('facebook',  { scope: ['email'] });
oauthRoutes('twitter',   {});   // OAuth 1.0a — no scope param
oauthRoutes('gitlab',    { scope: ['read_user'] });

// ─── Refresh Token ────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }
  try {
    const { accessToken, refreshToken } = await rotateSession(token);
    res
      .cookie('refresh_token', refreshToken, COOKIE_OPTS_REFRESH)
      .cookie('access_token', accessToken, COOKIE_OPTS_ACCESS)
      .json({ accessToken });
  } catch {
    res.clearCookie('refresh_token').clearCookie('access_token');
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── Logout ───────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (token) await deleteSession(token);
  res.clearCookie('refresh_token').clearCookie('access_token').json({ message: 'Logged out' });
});

// ─── Me ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { prisma } = await import('../lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, avatar: true, bio: true, provider: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

// ─── List available providers ─────────────────────────────────
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    providers: [
      { id: 'google',    name: 'Google',    url: '/api/auth/google' },
      { id: 'github',    name: 'GitHub',    url: '/api/auth/github' },
      { id: 'discord',   name: 'Discord',   url: '/api/auth/discord' },
      { id: 'linkedin',  name: 'LinkedIn',  url: '/api/auth/linkedin' },
      { id: 'microsoft', name: 'Microsoft', url: '/api/auth/microsoft' },
      { id: 'facebook',  name: 'Facebook',  url: '/api/auth/facebook' },
      { id: 'twitter',   name: 'Twitter',   url: '/api/auth/twitter' },
      { id: 'gitlab',    name: 'GitLab',    url: '/api/auth/gitlab' },
    ],
  });
});

export default router;
