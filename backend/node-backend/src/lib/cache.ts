import { redisClient } from './redis';

const DEFAULT_TTL = 3600; // 1 hour

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    if (!redisClient.isOpen) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(`[Cache] Error getting key ${key}:`, error);
    return null;
  }
}

export async function setCachedData(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.set(key, JSON.stringify(data), {
      EX: ttl
    });
  } catch (error) {
    console.warn(`[Cache] Error setting key ${key}:`, error);
  }
}

export async function invalidateCache(key: string | string[]): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.warn(`[Cache] Error invalidating keys ${key}:`, error);
  }
}

/**
 * Generates a consistent cache key for a user and resource
 */
export function generateCacheKey(userId: string, resource: string, params: any = {}): string {
  const paramStr = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join(':');
  return `cache:${userId}:${resource}${paramStr ? ':' + paramStr : ''}`;
}
