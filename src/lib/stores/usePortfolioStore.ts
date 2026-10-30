import { create } from 'zustand';
import { Account, AutoTagRule, BrokerId, Cluster, CurrencyCode, Holding, PortfolioSummary, PositionLot, Profile, ValuationDetail } from '@/types/portfolio';
import { DEFAULT_PROFILE_ID, db } from '@/lib/db';
import { brokerRegistry } from '@/lib/parsers/registry';
import { FileSnapshot } from '@/types/broker';
import { NlpClusterService } from '@/lib/services/nlpClusterService';
import { MarketPriceService } from '@/lib/services/marketPriceService';
import { CurrencyService } from '@/lib/services/currencyService';
import { StorageCompactionService, CompactionReport } from '@/lib/services/storageCompactionService';
import { DividendTransaction, MonthlyDividendAggregate, HoldingDividendSummary } from '@/types/dividend';
import { DividendService } from '@/lib/services/dividendService';
import { CurrencyDecompositionService } from '@/lib/services/currencyDecompositionService';
import { HoldingDailyChange, CurrencyAttributionBreakdown } from '@/types/attribution';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

interface PortfolioState {
  // Profiles
  profiles: Profile[];
  activeProfileId: string; // profile ID or 'consolidated'

  // Data for active profile
  accounts: Account[];
  holdings: Holding[];
  lots: PositionLot[];
  clusters: Cluster[];
  rules: AutoTagRule[];
  dividends: DividendTransaction[];
  
  selectedAccountFilter: string | null;
  selectedClusterFilter: string | null;
  searchQuery: string;
  
  isLoading: boolean;
  isRefreshingPrices: boolean;
  lastPriceRefreshAt: string | null;

  // Profile Actions
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string, avatarColor?: string) => Promise<string>;
  deleteProfile: (profileId: string) => Promise<void>;

  // Data Actions
  initFromDb: () => Promise<void>;
  importSnapshot: (snapshot: FileSnapshot, profileId?: string) => Promise<{ accountName: string; holdingsCount: number }>;
  importFile: (file: File) => Promise<{ accountName: string; holdingsCount: number }>;
  importFilesBatch: (files: File[]) => Promise<Array<{ accountName: string; holdingsCount: number }>>;
  importRawText: (text: string, fileName?: string) => Promise<{ accountName: string; holdingsCount: number }>;
  loadSampleFiles: () => Promise<Array<{ accountName: string; holdingsCount: number }>>;
  resetAndReloadSampleFiles: () => Promise<Array<{ accountName: string; holdingsCount: number }>>;
  compactDatabase: () => Promise<CompactionReport>;
  refreshLivePrices: () => Promise<void>;
  moveHoldingToCluster: (holdingId: string, clusterId: string) => Promise<void>;
  saveAutoRule: (pattern: string, clusterId: string, clusterName: string) => Promise<void>;
  updateHoldingTags: (holdingId: string, tags: string[]) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Cash & Account Management
  updateAccountCash: (accountId: string, cashBalances: Record<CurrencyCode, number>) => Promise<void>;
  addCashAccount: (name: string, balances: Record<CurrencyCode, number>, brokerId?: BrokerId) => Promise<string>;
  deleteAccount: (accountId: string) => Promise<void>;

  setAccountFilter: (accId: string | null) => void;
  setClusterFilter: (clusterId: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Computed Selectors
  getValuations: (displayCurrency: CurrencyCode, includeCash?: boolean) => ValuationDetail[];
  getSummary: (displayCurrency: CurrencyCode) => PortfolioSummary;
  getDividends: () => DividendTransaction[];
  getDividendsByMonth: () => MonthlyDividendAggregate[];
  getDividendsByHolding: () => HoldingDividendSummary[];
  getDividendSummary: () => { totalNetCZK: number; totalGrossCZK: number; totalTaxCZK: number; avgMonthlyNetCZK: number; effectiveTaxRate: number; count: number };
  getHoldingDailyChanges: () => HoldingDailyChange[];
  getCurrencyAttribution: () => CurrencyAttributionBreakdown[];
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  profiles: [],
  activeProfileId: DEFAULT_PROFILE_ID,

  accounts: [],
  holdings: [],
  lots: [],
  clusters: [],
  rules: [],
  dividends: [],

  selectedAccountFilter: null,
  selectedClusterFilter: null,
  searchQuery: '',

  isLoading: true,
  isRefreshingPrices: false,
  lastPriceRefreshAt: null,

  initFromDb: async () => {
    set({ isLoading: true });
    try {
      let profiles = await db.profiles.toArray();
      if (profiles.length === 0) {
        const defaultProfile: Profile = {
          id: DEFAULT_PROFILE_ID,
          name: 'Hlavní portfolio (Lukáš)',
          avatarColor: '#6366F1',
          isDefault: true,
          createdAt: new Date().toISOString(),
        };
        await db.profiles.add(defaultProfile);
        profiles = [defaultProfile];
      }

      const savedProfileId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_profile_id') : null;
      const activeId = (savedProfileId && (savedProfileId === 'consolidated' || profiles.some(p => p.id === savedProfileId)))
        ? savedProfileId
        : (profiles.find(p => p.isDefault)?.id || profiles[0].id);

      // Deduplicate orphaned holdings/lots where account was deleted
      const allAccounts = await db.accounts.toArray();
      const validAccountIds = new Set(allAccounts.map(a => a.id));
      const allHoldings = await db.holdings.toArray();
      const orphanedHoldings = allHoldings.filter(h => !validAccountIds.has(h.accountId));
      if (orphanedHoldings.length > 0) {
        await db.holdings.bulkDelete(orphanedHoldings.map(h => h.id));
      }
      const allLots = await db.lots.toArray();
      const orphanedLots = allLots.filter(l => !validAccountIds.has(l.accountId));
      if (orphanedLots.length > 0) {
        await db.lots.bulkDelete(orphanedLots.map(l => l.id));
      }

      set({ profiles, activeProfileId: activeId });
      await get().switchProfile(activeId);
    } catch (e) {
      console.error('Failed to init from DB', e);
      set({ isLoading: false });
    }
  },

  switchProfile: async (profileId: string) => {
    set({ isLoading: true, activeProfileId: profileId, selectedAccountFilter: null });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('active_profile_id', profileId);
    }

    try {
      let [accs, hlds, lts, cls, rls, divs] = await Promise.all([
        db.accounts.toArray(),
        db.holdings.toArray(),
        db.lots.toArray(),
        db.clusters.toArray(),
        db.rules.toArray(),
        db.dividends.toArray(),
      ]);

      if (profileId !== 'consolidated') {
        accs = accs.filter(a => (a.profileId || DEFAULT_PROFILE_ID) === profileId);
        hlds = hlds.filter(h => (h.profileId || DEFAULT_PROFILE_ID) === profileId);
        lts = lts.filter(l => (l.profileId || DEFAULT_PROFILE_ID) === profileId);
        cls = cls.filter(c => (c.profileId || DEFAULT_PROFILE_ID) === profileId || !c.profileId);
        rls = rls.filter(r => (r.profileId || DEFAULT_PROFILE_ID) === profileId || !r.profileId);
        divs = divs.filter(d => (d.profileId || DEFAULT_PROFILE_ID) === profileId);
      }

      set({
        accounts: accs,
        holdings: hlds,
        lots: lts,
        clusters: cls,
        rules: rls,
        dividends: divs,
        isLoading: false,
      });

      if (hlds.length > 0) {
        get().refreshLivePrices().catch(console.error);
      }
    } catch (e) {
      console.error('Failed to switch profile', e);
      set({ isLoading: false });
    }
  },

  createProfile: async (name: string, avatarColor = '#10B981') => {
    const newProfile: Profile = {
      id: `profile_${Date.now()}`,
      name,
      avatarColor,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    await db.profiles.add(newProfile);
    const profiles = await db.profiles.toArray();
    set({ profiles });
    await get().switchProfile(newProfile.id);
    return newProfile.id;
  },

  deleteProfile: async (profileId: string) => {
    if (profileId === DEFAULT_PROFILE_ID || profileId === 'consolidated') return;

    await db.transaction('rw', [db.profiles, db.accounts, db.holdings, db.lots, db.clusters, db.cashLedger], async () => {
      await db.accounts.where('profileId').equals(profileId).delete();
      await db.holdings.where('profileId').equals(profileId).delete();
      await db.lots.where('profileId').equals(profileId).delete();
      await db.clusters.where('profileId').equals(profileId).delete();
      await db.cashLedger.where('profileId').equals(profileId).delete();
      await db.profiles.delete(profileId);
    });

    const profiles = await db.profiles.toArray();
    set({ profiles });
    await get().switchProfile(DEFAULT_PROFILE_ID);
  },

  compactDatabase: async () => {
    const report = await StorageCompactionService.compactDatabase();
    await get().switchProfile(get().activeProfileId);
    return report;
  },

  importSnapshot: async (snapshot: FileSnapshot, profileId?: string) => {
    const { activeProfileId } = get();
    const targetProfileId = profileId || (activeProfileId === 'consolidated' ? DEFAULT_PROFILE_ID : activeProfileId);

    const result = await brokerRegistry.detectAndParse(snapshot);
    const accountId = `${targetProfileId}:${result.account.brokerId.toLowerCase()}-${result.account.accountNumber}`;

    const account: Account = {
      id: accountId,
      profileId: targetProfileId,
      brokerId: result.account.brokerId,
      accountNumber: result.account.accountNumber,
      name: result.account.accountName,
      baseCurrency: result.account.baseCurrency,
      cashBalances: result.account.cashBalances,
      lastImportAt: new Date().toISOString(),
    };

    // Purge any existing lots/holdings for this account to guarantee no duplicate accumulations
    await db.lots.where('accountId').equals(accountId).delete();
    await db.holdings.where('accountId').equals(accountId).delete();

    // Also clean any un-prefixed legacy accountId (e.g. "xtb-1726393" vs "profile_lukas_default:xtb-1726393")
    const legacyAccountId = `${result.account.brokerId.toLowerCase()}-${result.account.accountNumber}`;
    if (legacyAccountId !== accountId) {
      await db.lots.where('accountId').equals(legacyAccountId).delete();
      await db.holdings.where('accountId').equals(legacyAccountId).delete();
      await db.accounts.delete(legacyAccountId);
    }

    // Save account to DB
    await db.accounts.put(account);

    // Save lots
    const newLots: PositionLot[] = result.lots.map(l => ({
      id: `${accountId}-${l.ticketId}`,
      profileId: targetProfileId,
      accountId,
      holdingId: `${accountId}:${MarketPriceService.normalizeTicker(l.holdingRawTicker)}`,
      ticketId: l.ticketId,
      type: l.type,
      quantity: l.quantity,
      openPrice: l.openPrice,
      openDateUtc: l.openDateUtc,
      instrumentCurrency: l.instrumentCurrency,
      reportedCurrentPrice: l.reportedCurrentPrice,
      reportedNetProfit: l.reportedNetProfit,
    }));

    await db.lots.bulkPut(newLots);

    // Aggregate holdings from lots
    const existingRules = await db.rules.toArray();
    const newHoldings: Holding[] = [];

    for (const h of result.holdings) {
      const normTicker = MarketPriceService.normalizeTicker(h.rawTicker, h.isin);
      const holdingId = `${accountId}:${normTicker}`;
      const holdingLots = newLots.filter(l => l.holdingId === holdingId);
      
      const totalQuantity = holdingLots.reduce((acc, l) => acc + l.quantity, 0);
      const totalCost = holdingLots.reduce((acc, l) => acc + l.quantity * l.openPrice, 0);
      const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      const classification = NlpClusterService.classifyHolding(
        { rawTicker: h.rawTicker, name: h.name, isin: h.isin },
        existingRules
      );

      const holding: Holding = {
        id: holdingId,
        profileId: targetProfileId,
        accountId,
        brokerId: result.account.brokerId,
        rawTicker: h.rawTicker,
        normalizedTicker: normTicker,
        name: h.name,
        isin: h.isin,
        assetClass: h.assetClass,
        instrumentCurrency: h.instrumentCurrency,
        totalQuantity,
        averageOpenPrice: avgPrice,
        currentPrice: h.reportedCurrentPrice || avgPrice,
        lastPriceUpdate: new Date().toISOString(),
        clusterId: classification.clusterId,
        tags: classification.tags,
        benchmark: classification.benchmark,
      };

      newHoldings.push(holding);
    }

    await db.holdings.bulkPut(newHoldings);

    // Save cash ledger if present
    if (result.cashOperations && result.cashOperations.length > 0) {
      const ops = result.cashOperations.map(op => ({ ...op, profileId: targetProfileId, accountId }));
      await db.cashLedger.bulkPut(ops);
    }

    // Save dividends if present
    if (result.dividends && result.dividends.length > 0) {
      const rates = useCurrencyStore.getState().rates;
      const divs = result.dividends.map(div => {
        const fxRate = rates[div.currency] || 1.0;
        return {
          ...div,
          profileId: targetProfileId,
          accountId,
          fxRateToCZK: fxRate,
          grossAmountCZK: Math.round(div.grossAmount * fxRate * 100) / 100,
          withholdingTaxCZK: Math.round(div.withholdingTax * fxRate * 100) / 100,
          netAmountCZK: Math.round(div.netAmount * fxRate * 100) / 100,
        };
      });
      await db.dividends.bulkPut(divs);
    }

    // Run auto-clustering across all holdings
    const allHoldings = await db.holdings.toArray();
    const clusterResult = await NlpClusterService.autoClusterHoldings(allHoldings);
    await db.holdings.bulkPut(clusterResult.updatedHoldings);

    // Run storage compaction automatically after import
    await StorageCompactionService.compactDatabase().catch(console.warn);

    // Refresh state
    await get().switchProfile(activeProfileId);

    return {
      accountName: account.name,
      holdingsCount: newHoldings.length,
    };
  },

  importFile: async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const snapshot: FileSnapshot = {
      fileName: file.name,
      fileExtension: `.${file.name.split('.').pop() || ''}`,
      sizeBytes: file.size,
      data: arrayBuffer,
    };
    return await get().importSnapshot(snapshot);
  },

  importRawText: async (text: string, fileName = 'vypis.csv') => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const snapshot: FileSnapshot = {
      fileName,
      fileExtension: `.${fileName.split('.').pop() || 'csv'}`,
      sizeBytes: bytes.byteLength,
      data: bytes.buffer,
    };
    return await get().importSnapshot(snapshot);
  },

  loadSampleFiles: async () => {
    const { activeProfileId } = get();
    const targetProfileId = activeProfileId === 'consolidated' ? DEFAULT_PROFILE_ID : activeProfileId;

    // Reset target profile data first to ensure completely clean, non-duplicated load
    await Promise.all([
      db.accounts.where('profileId').equals(targetProfileId).delete(),
      db.holdings.where('profileId').equals(targetProfileId).delete(),
      db.lots.where('profileId').equals(targetProfileId).delete(),
      db.cashLedger.where('profileId').equals(targetProfileId).delete(),
    ]);

    const res = await fetch('/api/sample-files');
    if (!res.ok) throw new Error('Nepodařilo se kontaktovat server pro načtení výpisů.');
    const json = await res.json();
    const results: Array<{ accountName: string; holdingsCount: number }> = [];

    for (const f of json.files) {
      const binaryStr = atob(f.base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const snapshot: FileSnapshot = {
        fileName: f.name,
        fileExtension: `.${f.name.split('.').pop() || ''}`,
        sizeBytes: f.size,
        data: bytes.buffer,
      };
      try {
        const r = await get().importSnapshot(snapshot, targetProfileId);
        results.push(r);
      } catch (e) {
        console.error('Failed to import sample file:', f.name, e);
      }
    }
    await get().initFromDb();
    await get().refreshLivePrices();
    return results;
  },

  resetAndReloadSampleFiles: async () => {
    // 1. Completely clear all tables to wipe out any accumulated duplicate lots or legacy records
    await Promise.all([
      db.accounts.clear(),
      db.holdings.clear(),
      db.lots.clear(),
      db.cashLedger.clear(),
      db.clusters.clear(),
      db.dividends.clear(),
    ]);

    // 2. Fetch sample statements from backend
    const res = await fetch('/api/sample-files');
    if (!res.ok) throw new Error('Nepodařilo se kontaktovat server pro načtení výpisů.');
    const json = await res.json();
    const results: Array<{ accountName: string; holdingsCount: number }> = [];

    // 3. Import each snapshot into the default profile cleanly
    for (const f of json.files) {
      const binaryStr = atob(f.base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const snapshot: FileSnapshot = {
        fileName: f.name,
        fileExtension: `.${f.name.split('.').pop() || ''}`,
        sizeBytes: f.size,
        data: bytes.buffer,
      };
      try {
        const r = await get().importSnapshot(snapshot, DEFAULT_PROFILE_ID);
        results.push(r);
      } catch (e) {
        console.error('Failed to import sample file:', f.name, e);
      }
    }

    // 4. Initialize state & refresh quotes with resolved symbols
    await get().initFromDb();
    await get().refreshLivePrices();
    return results;
  },

  importFilesBatch: async (files: File[]) => {
    const results: Array<{ accountName: string; holdingsCount: number }> = [];
    for (const file of files) {
      try {
        const res = await get().importFile(file);
        results.push(res);
      } catch (e: any) {
        console.error(`Failed to import file ${file.name}:`, e);
        throw e;
      }
    }
    return results;
  },

  refreshLivePrices: async () => {
    const { holdings, isRefreshingPrices } = get();
    if (holdings.length === 0 || isRefreshingPrices) return;

    set({ isRefreshingPrices: true });

    try {
      const symbols = holdings.map(h => h.normalizedTicker);
      const quotes = await MarketPriceService.fetchQuotes(symbols);

      const updatedHoldings = holdings.map(h => {
        const q = quotes[h.normalizedTicker];
        if (q && q.price > 0) {
          return {
            ...h,
            currentPrice: q.price,
            previousClosePrice: q.previousClose || q.price,
            lastPriceUpdate: new Date().toISOString(),
          };
        }
        return h;
      });

      await db.holdings.bulkPut(updatedHoldings);
      set({
        holdings: updatedHoldings,
        isRefreshingPrices: false,
        lastPriceRefreshAt: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      console.error('Failed to refresh quotes:', e);
      set({ isRefreshingPrices: false });
    }
  },

  moveHoldingToCluster: async (holdingId: string, clusterId: string) => {
    const { holdings, clusters } = get();
    const holding = holdings.find(h => h.id === holdingId);
    const targetCluster = clusters.find(c => c.id === clusterId);
    if (!holding) return;

    const updated = {
      ...holding,
      clusterId,
      tags: targetCluster ? Array.from(new Set([...holding.tags, targetCluster.name])) : holding.tags,
      benchmark: targetCluster ? targetCluster.name : holding.benchmark,
    };

    await db.holdings.put(updated);
    set({
      holdings: holdings.map(h => h.id === holdingId ? updated : h),
    });
  },

  saveAutoRule: async (pattern: string, clusterId: string, clusterName: string) => {
    const { activeProfileId } = get();
    const newRule: AutoTagRule = {
      id: `rule-${Date.now()}`,
      profileId: activeProfileId === 'consolidated' ? DEFAULT_PROFILE_ID : activeProfileId,
      name: `Auto ${clusterName} for ${pattern}`,
      matchType: 'TOKEN_KEYWORD',
      pattern,
      assignedClusterId: clusterId,
      assignedClusterName: clusterName,
      assignedTags: [clusterName],
      assignedBenchmark: clusterName,
      weight: 80,
      createdAt: new Date().toISOString(),
    };

    await db.rules.put(newRule);
    const rules = await db.rules.toArray();
    set({ rules });

    // Re-run clustering
    const allHoldings = await db.holdings.toArray();
    const clusterResult = await NlpClusterService.autoClusterHoldings(allHoldings);
    await db.holdings.bulkPut(clusterResult.updatedHoldings);
    await get().initFromDb();
  },

  updateHoldingTags: async (holdingId: string, tags: string[]) => {
    const { holdings } = get();
    const holding = holdings.find(h => h.id === holdingId);
    if (!holding) return;

    const updated = { ...holding, tags };
    await db.holdings.put(updated);
    set({
      holdings: holdings.map(h => h.id === holdingId ? updated : h),
    });
  },

  clearAllData: async () => {
    const { activeProfileId } = get();
    if (activeProfileId === 'consolidated') {
      await Promise.all([
        db.accounts.clear(),
        db.holdings.clear(),
        db.lots.clear(),
        db.clusters.clear(),
        db.rules.clear(),
        db.cashLedger.clear(),
        db.dividends.clear(),
      ]);
    } else {
      await Promise.all([
        db.accounts.where('profileId').equals(activeProfileId).delete(),
        db.holdings.where('profileId').equals(activeProfileId).delete(),
        db.lots.where('profileId').equals(activeProfileId).delete(),
        db.clusters.where('profileId').equals(activeProfileId).delete(),
        db.cashLedger.where('profileId').equals(activeProfileId).delete(),
        db.dividends.where('profileId').equals(activeProfileId).delete(),
      ]);
    }

    await get().switchProfile(activeProfileId);
  },

  updateAccountCash: async (accountId: string, cashBalances: Record<CurrencyCode, number>) => {
    const { accounts } = get();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    const updated: Account = {
      ...account,
      cashBalances,
      lastImportAt: new Date().toISOString(),
    };

    await db.accounts.put(updated);
    set({
      accounts: accounts.map(a => a.id === accountId ? updated : a),
    });
  },

  addCashAccount: async (name: string, balances: Record<CurrencyCode, number>, brokerId: BrokerId = 'BANK') => {
    const { activeProfileId, accounts } = get();
    const targetProfileId = activeProfileId === 'consolidated' ? DEFAULT_PROFILE_ID : activeProfileId;
    const accountId = `${targetProfileId}:${brokerId.toLowerCase()}-${Date.now()}`;

    let baseCurrency: CurrencyCode = 'CZK';
    for (const [c, amt] of Object.entries(balances)) {
      if (amt && amt > 0) {
        baseCurrency = c as CurrencyCode;
        break;
      }
    }

    const cashBalances: Record<CurrencyCode, number> = {
      CZK: balances.CZK || 0,
      EUR: balances.EUR || 0,
      USD: balances.USD || 0,
      GBP: balances.GBP || 0,
    };

    const newAccount: Account = {
      id: accountId,
      profileId: targetProfileId,
      brokerId,
      accountNumber: `CASH-${Date.now().toString().slice(-6)}`,
      name: name.trim() || 'Hotovostní účet',
      baseCurrency,
      cashBalances,
      lastImportAt: new Date().toISOString(),
    };

    await db.accounts.put(newAccount);
    set({
      accounts: [...accounts, newAccount],
    });
    return accountId;
  },

  deleteAccount: async (accountId: string) => {
    const { accounts, holdings, lots } = get();
    await Promise.all([
      db.accounts.delete(accountId),
      db.holdings.where('accountId').equals(accountId).delete(),
      db.lots.where('accountId').equals(accountId).delete(),
    ]);

    set({
      accounts: accounts.filter(a => a.id !== accountId),
      holdings: holdings.filter(h => h.accountId !== accountId),
      lots: lots.filter(l => l.accountId !== accountId),
      selectedAccountFilter: get().selectedAccountFilter === accountId ? null : get().selectedAccountFilter,
    });
  },

  setAccountFilter: (accId) => set({ selectedAccountFilter: accId }),
  setClusterFilter: (clusterId) => set({ selectedClusterFilter: clusterId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // Selectors
  getValuations: (displayCurrency: CurrencyCode, includeCash: boolean = true) => {
    const { holdings, lots, accounts, selectedAccountFilter, selectedClusterFilter, searchQuery } = get();

    // Helper for diacritic-free & lowercase search
    const normalize = (str?: string) =>
      (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const q = normalize(searchQuery);

    // 1. Filter holdings
    let filtered = holdings;
    if (selectedAccountFilter) {
      filtered = filtered.filter(h => h.accountId === selectedAccountFilter);
    }
    if (selectedClusterFilter) {
      filtered = filtered.filter(
        h => h.clusterId === selectedClusterFilter ||
             h.benchmark === selectedClusterFilter ||
             h.tags.some(t => t.toLowerCase() === selectedClusterFilter.toLowerCase())
      );
    }
    if (q) {
      filtered = filtered.filter(h =>
        normalize(h.name).includes(q) ||
        normalize(h.rawTicker).includes(q) ||
        normalize(h.normalizedTicker).includes(q) ||
        (h.isin && normalize(h.isin).includes(q)) ||
        normalize(h.brokerId).includes(q) ||
        normalize(h.instrumentCurrency).includes(q) ||
        normalize(h.assetClass).includes(q) ||
        h.tags.some(t => normalize(t).includes(q))
      );
    }

    // Convert each securities holding to ValuationDetail
    const rawValuations: ValuationDetail[] = filtered.map(holding => {
      const holdingLots = lots.filter(l => l.holdingId === holding.id);
      const quantity = holding.totalQuantity;
      const currentPriceNative = holding.currentPrice;
      const costPriceNative = holding.averageOpenPrice;

      const marketValueNative = quantity * currentPriceNative;
      const costBasisNative = quantity * costPriceNative;
      const unrealizedProfitNative = marketValueNative - costBasisNative;
      const unrealizedProfitPercent = costBasisNative > 0 
        ? (unrealizedProfitNative / costBasisNative) * 100 
        : 0;

      const fxRate = CurrencyService.getRate(holding.instrumentCurrency, displayCurrency);
      const currentPriceTarget = currentPriceNative * fxRate;
      const marketValueTarget = marketValueNative * fxRate;

      // Calculate cost basis in target currency
      let costBasisTarget = 0;
      if (holdingLots.length > 0) {
        costBasisTarget = holdingLots.reduce((acc, lot) => {
          const lotCostNative = lot.quantity * lot.openPrice;
          const lotFx = CurrencyService.getRate(lot.instrumentCurrency, displayCurrency);
          return acc + (lotCostNative * lotFx);
        }, 0);
      } else {
        costBasisTarget = costBasisNative * fxRate;
      }

      const unrealizedProfitTarget = marketValueTarget - costBasisTarget;

      // Pure asset gain at historical FX vs FX gain
      const pureAssetGainTarget = (currentPriceNative - costPriceNative) * quantity * fxRate;
      const fxGainTarget = unrealizedProfitTarget - pureAssetGainTarget;

      return {
        holding,
        quantity,
        instrumentCurrency: holding.instrumentCurrency,
        currentPriceNative,
        costBasisNative,
        marketValueNative,
        unrealizedProfitNative,
        unrealizedProfitPercent,

        targetCurrency: displayCurrency,
        exchangeRateNativeToTarget: fxRate,
        currentPriceTarget,
        costBasisTarget,
        marketValueTarget,
        unrealizedProfitTarget,
        pureAssetGainTarget,
        fxGainTarget,
        weightInPortfolio: 0,
      };
    });

    // 2. Synthesize cash holdings from accounts if includeCash is true
    const cashValuations: ValuationDetail[] = [];
    if (includeCash) {
      let relevantAccounts = accounts;
      if (selectedAccountFilter) {
        relevantAccounts = accounts.filter(a => a.id === selectedAccountFilter);
      }

      for (const acc of relevantAccounts) {
        for (const [currStr, amt] of Object.entries(acc.cashBalances || {})) {
          const curr = currStr as CurrencyCode;
          if (amt && amt > 0.0001) {
            // Apply cluster filter for cash: only keep if cluster is 'cash' or matches 'hotovost' or no cluster filter
            if (
              selectedClusterFilter &&
              selectedClusterFilter !== 'cash' &&
              selectedClusterFilter.toLowerCase() !== 'hotovost'
            ) {
              continue;
            }

            const cashName = `Hotovost – ${acc.name} (${curr})`;

            // Apply search filter for cash
            if (q) {
              const matchesSearch =
                normalize(cashName).includes(q) ||
                normalize(curr).includes(q) ||
                normalize(acc.name).includes(q) ||
                normalize(acc.brokerId).includes(q) ||
                q.includes('hotov') ||
                q.includes('cash');
              if (!matchesSearch) continue;
            }

            const fxRate = CurrencyService.getRate(curr, displayCurrency);
            const valueTarget = amt * fxRate;

            const cashHolding: Holding = {
              id: `${acc.id}:cash:${curr}`,
              profileId: acc.profileId,
              accountId: acc.id,
              brokerId: acc.brokerId,
              rawTicker: curr,
              normalizedTicker: `CASH-${curr}`,
              name: cashName,
              assetClass: 'CASH',
              instrumentCurrency: curr,
              totalQuantity: amt,
              averageOpenPrice: 1,
              currentPrice: 1,
              lastPriceUpdate: acc.lastImportAt || new Date().toISOString(),
              clusterId: 'cash',
              tags: ['Hotovost', curr, acc.name],
              benchmark: 'Hotovost',
            };

            cashValuations.push({
              holding: cashHolding,
              quantity: amt,
              instrumentCurrency: curr,
              currentPriceNative: 1,
              costBasisNative: amt,
              marketValueNative: amt,
              unrealizedProfitNative: 0,
              unrealizedProfitPercent: 0,
              targetCurrency: displayCurrency,
              exchangeRateNativeToTarget: fxRate,
              currentPriceTarget: fxRate,
              costBasisTarget: valueTarget,
              marketValueTarget: valueTarget,
              unrealizedProfitTarget: 0,
              pureAssetGainTarget: 0,
              fxGainTarget: 0,
              weightInPortfolio: 0,
            });
          }
        }
      }
    }

    const allValuations = [...rawValuations, ...cashValuations];

    // Calculate portfolio weights across total portfolio (securities + cash)
    const totalMarketValue = allValuations.reduce((acc, v) => acc + v.marketValueTarget, 0);
    return allValuations.map(v => ({
      ...v,
      weightInPortfolio: totalMarketValue > 0 ? (v.marketValueTarget / totalMarketValue) * 100 : 0,
    }));
  },

  getSummary: (displayCurrency: CurrencyCode) => {
    const allValuations = get().getValuations(displayCurrency, true);
    const securitiesValuations = allValuations.filter(v => v.holding.assetClass !== 'CASH');
    const cashValuations = allValuations.filter(v => v.holding.assetClass === 'CASH');

    const { accounts, selectedAccountFilter } = get();
    let relevantAccounts = accounts;
    if (selectedAccountFilter) {
      relevantAccounts = accounts.filter(a => a.id === selectedAccountFilter);
    }

    const totalSecuritiesValue = securitiesValuations.reduce((acc, v) => acc + v.marketValueTarget, 0);
    const totalCashValue = cashValuations.reduce((acc, v) => acc + v.marketValueTarget, 0);
    const totalNav = totalSecuritiesValue + totalCashValue;
    const totalMarketValue = totalNav;

    const securitiesCostBasis = securitiesValuations.reduce((acc, v) => acc + v.costBasisTarget, 0);
    const totalCostBasis = securitiesCostBasis + totalCashValue; // Total invested capital

    const totalUnrealizedProfit = securitiesValuations.reduce((acc, v) => acc + v.unrealizedProfitTarget, 0);
    const pureAssetGain = securitiesValuations.reduce((acc, v) => acc + v.pureAssetGainTarget, 0);
    const fxGain = securitiesValuations.reduce((acc, v) => acc + v.fxGainTarget, 0);

    const totalUnrealizedProfitPercent = securitiesCostBasis > 0 
      ? (totalUnrealizedProfit / securitiesCostBasis) * 100 
      : 0;

    // Herfindahl-Hirschman Index and Concentration
    const sortedValuations = [...allValuations].sort((a, b) => b.marketValueTarget - a.marketValueTarget);
    let hhi = 0;
    if (totalMarketValue > 0) {
      for (const v of allValuations) {
        const share = v.marketValueTarget / totalMarketValue;
        hhi += share * share;
      }
    }
    const effectiveHoldingsCount = hhi > 0 ? 1 / hhi : 0;
    const top1Concentration = totalMarketValue > 0 && sortedValuations.length > 0
      ? (sortedValuations[0].marketValueTarget / totalMarketValue) * 100
      : 0;
    const top5Concentration = totalMarketValue > 0
      ? (sortedValuations.slice(0, 5).reduce((sum, v) => sum + v.marketValueTarget, 0) / totalMarketValue) * 100
      : 0;

    return {
      displayCurrency,
      totalMarketValue,
      totalSecuritiesValue,
      totalCashValue,
      totalNav,
      totalCostBasis,
      totalUnrealizedProfit,
      totalUnrealizedProfitPercent,
      pureAssetGain,
      fxGain,
      hhi,
      effectiveHoldingsCount,
      top1Concentration,
      top5Concentration,
      holdingsCount: allValuations.length,
      accountsCount: relevantAccounts.length,
    };
  },

  getDividends: () => {
    return get().dividends;
  },

  getDividendsByMonth: () => {
    return DividendService.aggregateByMonth(get().dividends);
  },

  getDividendsByHolding: () => {
    return DividendService.aggregateByHolding(get().dividends, get().holdings, get().lots);
  },

  getDividendSummary: () => {
    return DividendService.calculateOverallSummary(get().dividends);
  },

  getHoldingDailyChanges: () => {
    const { holdings } = get();
    const rates = useCurrencyStore.getState().rates;
    return CurrencyDecompositionService.calculateHoldingDailyChanges(holdings, rates);
  },

  getCurrencyAttribution: () => {
    const { holdings, lots } = get();
    const rates = useCurrencyStore.getState().rates;
    return CurrencyDecompositionService.calculateCurrencyAttribution(holdings, lots, rates);
  },
}));
