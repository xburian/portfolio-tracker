export interface StorageStatus {
  type: 'memory' | 'redis';
  connected: boolean;
  details?: string;
  keysCount?: number;
}

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  getStatus(): Promise<StorageStatus>;
  disconnect(): Promise<void>;
  getType(): 'memory' | 'redis';
}
