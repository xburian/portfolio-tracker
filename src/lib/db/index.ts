import Dexie, { type EntityTable } from 'dexie';
import { Profile, Account, Holding, PositionLot, Cluster, AutoTagRule, CashLedgerTransaction } from '@/types/portfolio';
import { DividendTransaction } from '@/types/dividend';
import { SalaryConfig, ExpenseCategory } from '@/types/budget';

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
  dividends: EntityTable<DividendTransaction, 'id'>;
  salaryConfigs: EntityTable<SalaryConfig, 'profileId'>;
  expenseCategories: EntityTable<ExpenseCategory, 'id'>;
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

// Dexie Version 3: Personal Finance, Dividends & Budget Expansion
db.version(3).stores({
  profiles: 'id, isDefault, createdAt',
  accounts: 'id, profileId, brokerId, accountNumber',
  holdings: 'id, profileId, accountId, normalizedTicker, clusterId, assetClass',
  lots: 'id, profileId, accountId, holdingId, ticketId',
  clusters: 'id, profileId, name',
  rules: 'id, profileId, pattern, assignedClusterId',
  cashLedger: 'id, profileId, accountId, type, timeUtc',
  exchangeRates: 'pair, timestamp',
  dividends: 'id, profileId, accountId, normalizedTicker, isin, paymentDateUtc, yearMonth, [profileId+yearMonth], [profileId+normalizedTicker]',
  salaryConfigs: 'profileId, paydayDayOfMonth, updatedAt',
  expenseCategories: 'id, profileId, name, isEssential',
}).upgrade(async (tx) => {
  const salaryTable = tx.table('salaryConfigs');
  const expenseTable = tx.table('expenseCategories');

  const existingSalary = await salaryTable.get(DEFAULT_PROFILE_ID);
  if (!existingSalary) {
    await salaryTable.add({
      profileId: DEFAULT_PROFILE_ID,
      baseMonthlyNetSalaryCZK: 85000,
      paydayDayOfMonth: 15,
      annualIncreasePercentage: 5.0,
      increaseMonth: 1,
      bonuses: [
        { id: 'bonus-13', name: '13. plat / Vánoční bonus', month: 11, amountNetCZK: 50000, isRecurringAnnual: true }
      ],
      updatedAt: new Date().toISOString(),
    });

    const defaultExpenses: ExpenseCategory[] = [
      { id: 'exp_housing', profileId: DEFAULT_PROFILE_ID, name: 'Bydlení & Nájem', monthlyAmountCZK: 25000, isEssential: true, colorHex: '#EF4444', annualInflationPercentage: 4.0 },
      { id: 'exp_food', profileId: DEFAULT_PROFILE_ID, name: 'Jídlo & Potraviny', monthlyAmountCZK: 12000, isEssential: true, colorHex: '#F59E0B', annualInflationPercentage: 3.5 },
      { id: 'exp_utilities', profileId: DEFAULT_PROFILE_ID, name: 'Internet, Energie & Služby', monthlyAmountCZK: 6500, isEssential: true, colorHex: '#3B82F6', annualInflationPercentage: 3.0 },
      { id: 'exp_transport', profileId: DEFAULT_PROFILE_ID, name: 'Doprava & Auto', monthlyAmountCZK: 5000, isEssential: true, colorHex: '#10B981', annualInflationPercentage: 2.5 },
      { id: 'exp_leisure', profileId: DEFAULT_PROFILE_ID, name: 'Zábava, Sport & Ostatní', monthlyAmountCZK: 7500, isEssential: false, colorHex: '#8B5CF6', annualInflationPercentage: 3.0 },
    ];

    for (const exp of defaultExpenses) {
      await expenseTable.add(exp);
    }
  }
});
