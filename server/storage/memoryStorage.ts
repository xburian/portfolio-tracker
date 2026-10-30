import { StorageAdapter, StorageStatus } from './storageAdapter';

interface MemoryItem {
  value: string;
  expiresAt?: number;
}

export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, MemoryItem>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic garbage collection for expired keys every 60s
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired();
    }, 60000);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt !== undefined && item.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt !== undefined && item.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    this.purgeExpired();
    const allKeys = Array.from(this.store.keys());
    if (!pattern || pattern === '*') return allKeys;

    // Convert simple redis-like pattern to regex (e.g. user:* -> ^user:.*$)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter((k) => regex.test(k));
  }

  async getStatus(): Promise<StorageStatus> {
    this.purgeExpired();
    return {
      type: 'memory',
      connected: true,
      details: 'Local In-Memory storage (zero external dependencies)',
      keysCount: this.store.size,
    };
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getType(): 'memory' {
    return 'memory';
  }
}
