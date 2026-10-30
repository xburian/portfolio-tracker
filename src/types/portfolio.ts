export type CurrencyCode = 'CZK' | 'EUR' | 'USD' | 'GBP';
export type BrokerId = 'XTB' | 'DEGIRO' | 'IBKR' | 'PORTU' | 'GENERIC_CSV' | 'BANK' | 'CASH';
export type AssetClass = 'EQUITY' | 'ETF' | 'COMMODITY' | 'CRYPTO' | 'BOND' | 'CASH' | 'OTHER';

export interface Profile {
  id: string;                         // e.g. "profile_default", "prof_123"
  name: string;                       // "Hlavní portfolio (Lukáš)", "Manželka", "Firma"
  avatarColor: string;                // "#6366F1", "#10B981", "#F59E0B", "#EC4899"
  isDefault: boolean;
  createdAt: string;
}

export interface Account {
  id: string;                         // e.g. "xtb-1726393"
  profileId?: string;                 // Foreign key to Profile.id
  brokerId: BrokerId;
  accountNumber: string;              // "1726393"
  name: string;                       // "XTB CZK Hlavní"
  baseCurrency: CurrencyCode;         // "CZK"
  cashBalances: Record<CurrencyCode, number>;
  lastImportAt: string;
}

export interface PositionLot {
  id: string;                         // e.g. "xtb-1726393-718319320"
  profileId?: string;
  accountId: string;
  holdingId: string;
  ticketId: string;                   // "718319320"
  type: 'BUY' | 'SELL';
  quantity: number;                   // fractional shares supported
  openPrice: number;                  // In instrumentCurrency
  openDateUtc: string;                // ISO 8601 UTC
  instrumentCurrency: CurrencyCode;
  reportedCurrentPrice?: number;
  reportedNetProfit?: number;
}

export interface Holding {
  id: string;                         // "${accountId}:${normalizedTicker}"
  profileId?: string;
  accountId: string;
  brokerId: BrokerId;
  rawTicker: string;                  // "SXR8.DE"
  normalizedTicker: string;           // "SXR8.DE" (Yahoo Finance symbol)
  name: string;                       // "Core S&P 500"
  isin?: string;                      // "IE00B5BMR087"
  assetClass: AssetClass;
  instrumentCurrency: CurrencyCode;
  
  totalQuantity: number;
  averageOpenPrice: number;           // Weighted average in instrumentCurrency
  currentPrice: number;               // Live or last known price in instrumentCurrency
  lastPriceUpdate: string;
  
  clusterId?: string;                 // Assigned cluster / group
  tags: string[];                     // ["S&P 500", "US Large Cap"]
  benchmark?: string;                 // "S&P 500"
  notes?: string;
}

export interface Cluster {
  id: string;                         // e.g. "cluster_sp500"
  profileId?: string;
  name: string;                       // "S&P 500 Index"
  color: string;                      // Hex color code
  rulePattern?: string;               // Optional regex / keyword pattern for auto-inclusion
  isUserDefined?: boolean;
}

export interface AutoTagRule {
  id: string;
  profileId?: string;
  name: string;
  matchType: 'EXACT_SYMBOL' | 'ISIN' | 'TOKEN_KEYWORD' | 'REGEX';
  pattern: string;
  assignedClusterId: string;
  assignedClusterName: string;
  assignedTags: string[];
  assignedAssetClass?: AssetClass;
  assignedBenchmark?: string;
  weight: number;
  createdAt: string;
}

export interface CashLedgerTransaction {
  id: string;
  profileId?: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'TAX' | 'INTEREST' | 'FEE' | 'TRANSFER' | 'OTHER';
  amount: number;
  currency: CurrencyCode;
  timeUtc: string;
  comment?: string;
  relatedTicketId?: string;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  currency: CurrencyCode;
  previousClose: number;
  change: number;
  changePercent: number;
  marketState: 'REGULAR' | 'CLOSED' | 'PRE' | 'POST';
  timestamp: number;
}

export interface ValuationDetail {
  holding: Holding;
  quantity: number;
  instrumentCurrency: CurrencyCode;
  currentPriceNative: number;
  costBasisNative: number;
  marketValueNative: number;
  unrealizedProfitNative: number;
  unrealizedProfitPercent: number;

  targetCurrency: CurrencyCode;
  exchangeRateNativeToTarget: number;
  currentPriceTarget: number;
  costBasisTarget: number;
  marketValueTarget: number;
  unrealizedProfitTarget: number;
  pureAssetGainTarget: number;
  fxGainTarget: number;
  weightInPortfolio: number;
}

export interface PortfolioSummary {
  displayCurrency: CurrencyCode;
  totalMarketValue: number;
  totalSecuritiesValue?: number;
  totalCostBasis: number;
  totalUnrealizedProfit: number;
  totalUnrealizedProfitPercent: number;
  totalCashValue: number;
  totalNav: number; // Securities + Cash
  pureAssetGain: number;
  fxGain: number;

  hhi: number;
  effectiveHoldingsCount: number;
  top1Concentration: number;
  top5Concentration: number;
  holdingsCount: number;
  accountsCount: number;
}
