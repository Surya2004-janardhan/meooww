import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAccessToken, JwtPayload } from '../lib/jwt';

export type { JwtPayload };
export type AuthRequest = Request;

export const authenticate: RequestHandler = (req, res, next) => {
  const authReq = req as Request;
  const authHeader = authReq.headers.authorization;
  const cookieToken = authReq.cookies?.access_token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    authReq.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
