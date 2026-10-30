import Dexie, { type EntityTable } from 'dexie';
import { Profile, Account, Holding, PositionLot, Cluster, AutoTagRule, CashLedgerTransaction } from '@/types/portfolio';

export interface StoredExchangeRate {
  pair: string; // e.g. "EUR_CZK", "USD_CZK"
  rate: number;
  timestamp: number;
}

export const DEFAULT_PROFILE_ID = 'profile_lukas_default';

export const db = new Dexie('PortfolioTrackerDB') as Dexie & {
  profiles: EntityTable<Profile, 'id'>;
  accounts: EntityTable<Account, 'id'>;
  holdings: EntityTable<Holding, 'id'>;
  lots: EntityTable<PositionLot, 'id'>;
  clusters: EntityTable<Cluster, 'id'>;
  rules: EntityTable<AutoTagRule, 'id'>;
  cashLedger: EntityTable<CashLedgerTransaction, 'id'>;
  exchangeRates: EntityTable<StoredExchangeRate, 'pair'>;
};

// Dexie Version 1 (Initial schema)
db.version(1).stores({
  accounts: 'id, brokerId, accountNumber',
  holdings: 'id, accountId, normalizedTicker, rawTicker, clusterId, assetClass',
  lots: 'id, accountId, holdingId, ticketId',
  clusters: 'id, name',
  rules: 'id, pattern, assignedClusterId',
  cashLedger: 'id, accountId, type, timeUtc',
  exchangeRates: 'pair, timestamp',
});

// Dexie Version 2: Multi-User / Multi-Profile with zero data loss migration
db.version(2).stores({
  profiles: 'id, isDefault, createdAt',
  accounts: 'id, profileId, brokerId, accountNumber',
  holdings: 'id, profileId, accountId, normalizedTicker, clusterId, assetClass',
  lots: 'id, profileId, accountId, holdingId, ticketId',
  clusters: 'id, profileId, name',
  rules: 'id, profileId, pattern, assignedClusterId',
  cashLedger: 'id, profileId, accountId, type, timeUtc',
  exchangeRates: 'pair, timestamp',
}).upgrade(async (tx) => {
  const profilesTable = tx.table('profiles');
  const count = await profilesTable.count();

  if (count === 0) {
    const defaultProfile: Profile = {
      id: DEFAULT_PROFILE_ID,
      name: 'Hlavní portfolio (Lukáš)',
      avatarColor: '#6366F1',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    await profilesTable.add(defaultProfile);
  }

  // Migrate existing records to default profile
  const tables = ['accounts', 'holdings', 'lots', 'clusters', 'rules', 'cashLedger'];
  for (const tableName of tables) {
    await tx.table(tableName).toCollection().modify((record: any) => {
      if (!record.profileId) {
        record.profileId = DEFAULT_PROFILE_ID;
      }
    });
  }
});
