import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

export async function createSession(userId: string, email: string) {
  const refreshToken = signRefreshToken({ sub: userId, email });
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await prisma.session.create({
    data: { userId, refreshToken, expiresAt },
  });

  const accessToken = signAccessToken({ sub: userId, email });
  return { accessToken, refreshToken };
}

export async function rotateSession(oldRefreshToken: string) {
  const session = await prisma.session.findUnique({
    where: { refreshToken: oldRefreshToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  // Delete old session
  await prisma.session.delete({ where: { id: session.id } });

  // Create new session
  return createSession(session.userId, session.user.email);
}

export async function deleteSession(refreshToken: string) {
  await prisma.session.deleteMany({ where: { refreshToken } });
}
