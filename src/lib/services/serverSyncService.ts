import { db } from '@/lib/db';
import { useAuthStore } from '@/lib/stores/useAuthStore';

export interface StorageSyncCounts {
  profiles: number;
  accounts: number;
  holdings: number;
  lots: number;
  clusters: number;
  rules: number;
  cashLedger: number;
  dividends: number;
  salaryConfigs: number;
  expenseCategories: number;
}

export interface StorageSyncResponse {
  success: boolean;
  userId: string;
  syncedAt?: string;
  counts?: Partial<StorageSyncCounts>;
}

export interface StorageInspectResponse {
  storage: {
    type: 'memory' | 'redis';
    connected: boolean;
    details?: string;
    keysCount?: number;
  };
  totalKeys: number;
  authKeysCount: number;
  portfolioKeysCount: number;
  entityBreakdown: Record<string, number>;
  keys: string[];
}

export class ServerSyncService {
  private static debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static isSyncing = false;
  private static lastSyncedAt: string | null = null;

  public static getLastSyncedAt(): string | null {
    return this.lastSyncedAt;
  }

  /**
   * Pushes all client database tables (Dexie) into backend In-Memory / Redis storage.
   * Debounced by default to coalesce rapid successive operations.
   */
  public static async pushToBackend(immediate = false): Promise<StorageSyncResponse | null> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!immediate) {
      return new Promise((resolve) => {
        this.debounceTimer = setTimeout(async () => {
          const res = await this.executePush();
          resolve(res);
        }, 300);
      });
    }

    return this.executePush();
  }

  private static async executePush(): Promise<StorageSyncResponse | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;

    try {
      const [
        profiles,
        accounts,
        holdings,
        lots,
        clusters,
        rules,
        cashLedger,
        dividends,
        salaryConfigs,
        expenseCategories,
      ] = await Promise.all([
        db.profiles.toArray(),
        db.accounts.toArray(),
        db.holdings.toArray(),
        db.lots.toArray(),
        db.clusters.toArray(),
        db.rules.toArray(),
        db.cashLedger.toArray(),
        db.dividends.toArray(),
        db.salaryConfigs.toArray(),
        db.expenseCategories.toArray(),
      ]);

      const payload = {
        data: {
          profiles,
          accounts,
          holdings,
          lots,
          clusters,
          rules,
          cashLedger,
          dividends,
          salaryConfigs,
          expenseCategories,
        },
      };

      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn('Failed to push portfolio to backend storage:', res.status);
        return null;
      }

      const result: StorageSyncResponse = await res.json();
      this.lastSyncedAt = result.syncedAt || new Date().toISOString();

      // Trigger status refresh so keys count and breakdown update in UI
      useAuthStore.getState().fetchStorageStatus().catch(() => {});

      return result;
    } catch (err) {
      console.warn('Backend storage sync push error:', err);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pulls all portfolio & budget data from backend In-Memory / Redis storage into client Dexie.
   * Returns true if data was retrieved and restored.
   */
  public static async pullFromBackend(): Promise<boolean> {
    try {
      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/sync', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!res.ok) return false;

      const body = await res.json();
      if (!body.hasData || !body.data) return false;

      const data = body.data;

      await db.transaction('rw', [
        db.profiles,
        db.accounts,
        db.holdings,
        db.lots,
        db.clusters,
        db.rules,
        db.cashLedger,
        db.dividends,
        db.salaryConfigs,
        db.expenseCategories,
      ], async () => {
        if (data.profiles && data.profiles.length > 0) {
          await db.profiles.clear();
          await db.profiles.bulkAdd(data.profiles);
        }
        if (data.accounts && data.accounts.length > 0) {
          await db.accounts.clear();
          await db.accounts.bulkAdd(data.accounts);
        }
        if (data.holdings && data.holdings.length > 0) {
          await db.holdings.clear();
          await db.holdings.bulkAdd(data.holdings);
        }
        if (data.lots && data.lots.length > 0) {
          await db.lots.clear();
          await db.lots.bulkAdd(data.lots);
        }
        if (data.clusters && data.clusters.length > 0) {
          await db.clusters.clear();
          await db.clusters.bulkAdd(data.clusters);
        }
        if (data.rules && data.rules.length > 0) {
          await db.rules.clear();
          await db.rules.bulkAdd(data.rules);
        }
        if (data.cashLedger && data.cashLedger.length > 0) {
          await db.cashLedger.clear();
          await db.cashLedger.bulkAdd(data.cashLedger);
        }
        if (data.dividends && data.dividends.length > 0) {
          await db.dividends.clear();
          await db.dividends.bulkAdd(data.dividends);
        }
        if (data.salaryConfigs && data.salaryConfigs.length > 0) {
          await db.salaryConfigs.clear();
          await db.salaryConfigs.bulkAdd(data.salaryConfigs);
        }
        if (data.expenseCategories && data.expenseCategories.length > 0) {
          await db.expenseCategories.clear();
          await db.expenseCategories.bulkAdd(data.expenseCategories);
        }
      });

      this.lastSyncedAt = body.meta?.syncedAt || new Date().toISOString();
      return true;
    } catch (err) {
      console.warn('Backend storage sync pull error:', err);
      return false;
    }
  }

  /**
   * Clears backend stored data for current user.
   */
  public static async clearBackend(): Promise<boolean> {
    try {
      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/sync', {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        useAuthStore.getState().fetchStorageStatus().catch(() => {});
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Diagnostic inspect of backend storage (keys, counts, breakdowns).
   */
  public static async inspectStorage(): Promise<StorageInspectResponse | null> {
    try {
      const res = await fetch('/api/storage/inspect');
      if (res.ok) {
        return (await res.json()) as StorageInspectResponse;
      }
      return null;
    } catch {
      return null;
    }
  }
}
