import Redis, { RedisOptions } from 'ioredis';
import { StorageAdapter, StorageStatus } from './storageAdapter';

export class RedisStorage implements StorageAdapter {
  private client: Redis;
  private isConnected = false;
  private connectionError: string | null = null;
  private url: string;

  constructor(redisUrl?: string, customOptions?: RedisOptions) {
    this.url = redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    const defaultOptions: RedisOptions = {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 3) {
          this.connectionError = 'Max Redis connection attempts exceeded';
          return null; // Stop retrying
        }
        return Math.min(times * 150, 2000);
      },
      lazyConnect: true,
      connectTimeout: 3000,
      ...customOptions,
    };

    this.client = new Redis(this.url, defaultOptions);

    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionError = null;
      console.log(`[RedisStorage] Connected to Redis at ${this.maskUrl(this.url)}`);
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.connectionError = null;
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.connectionError = err.message;
      // Do not crash process on unhandled redis error
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
  }

  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) parsed.password = '***';
      return parsed.toString();
    } catch {
      return 'redis://[custom]';
    }
  }

  async init(): Promise<boolean> {
    try {
      await this.client.connect();
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Failed to connect to Redis';
      console.warn(`[RedisStorage] Could not connect to Redis: ${this.connectionError}`);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err: any) {
      console.error(`[RedisStorage] get("${key}") failed:`, err.message);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      console.error(`[RedisStorage] set("${key}") failed:`, err.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      console.error(`[RedisStorage] del("${key}") failed:`, err.message);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch (err: any) {
      console.error(`[RedisStorage] has("${key}") failed:`, err.message);
      return false;
    }
  }

  async keys(pattern = '*'): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (err: any) {
      console.error(`[RedisStorage] keys("${pattern}") failed:`, err.message);
      return [];
    }
  }

  async getStatus(): Promise<StorageStatus> {
    let keysCount = 0;
    if (this.isConnected) {
      try {
        const dbsize = await this.client.dbsize();
        keysCount = dbsize;
      } catch {
        // ignore
      }
    }

    return {
      type: 'redis',
      connected: this.isConnected,
      details: this.isConnected
        ? `Connected to Redis at ${this.maskUrl(this.url)}`
        : `Redis disconnected: ${this.connectionError || 'Pending or failed connection'}`,
      keysCount,
    };
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  getType(): 'redis' {
    return 'redis';
  }
}
