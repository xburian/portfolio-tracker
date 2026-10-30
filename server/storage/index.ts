import { StorageAdapter } from './storageAdapter';
import { MemoryStorage } from './memoryStorage';
import { RedisStorage } from './redisStorage';

let storageInstance: StorageAdapter | null = null;

export async function initStorage(): Promise<StorageAdapter> {
  if (storageInstance) {
    return storageInstance;
  }

  const requestedType = (process.env.STORAGE_TYPE || '').toLowerCase();
  const redisUrl = process.env.REDIS_URL;
  const isRedisRequested = requestedType === 'redis' || Boolean(redisUrl);

  if (isRedisRequested) {
    console.log(`[Storage] Initializing production Redis storage (${redisUrl ? 'REDIS_URL found' : 'default localhost:6379'})...`);
    const redis = new RedisStorage(redisUrl);
    const success = await redis.init();

    if (success) {
      storageInstance = redis;
      console.log('[Storage] Production Redis persistent storage is active and ready.');
      return storageInstance;
    }

    console.warn('[Storage] Redis connection failed. Falling back to high-performance local In-Memory storage.');
  } else {
    console.log('[Storage] Initializing local In-Memory storage (set REDIS_URL to activate Redis persistent storage).');
  }

  storageInstance = new MemoryStorage();
  return storageInstance;
}

export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    // Default fallback to MemoryStorage synchronously if called before initStorage
    storageInstance = new MemoryStorage();
  }
  return storageInstance;
}

export { MemoryStorage, RedisStorage };
export type { StorageAdapter };
