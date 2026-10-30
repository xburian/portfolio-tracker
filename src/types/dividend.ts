import { BrokerId, CurrencyCode } from './portfolio';

export interface DividendTransaction {
  id: string;                         // e.g. "div_xtb_1726393_aapl_20240515"
  profileId: string;                  // Foreign key to Profile.id
  accountId: string;                  // e.g. "xtb-1726393"
  brokerId: BrokerId;
  rawTicker: string;                  // e.g. "AAPL.US"
  normalizedTicker: string;           // e.g. "AAPL"
  isin?: string;
  paymentDateUtc: string;             // ISO 8601 UTC
  yearMonth: string;                  // "YYYY-MM"
  grossAmount: number;                // Hrubá dividenda v instrumentCurrency
  withholdingTax: number;             // Sražená daň (kladná hodnota)
  netAmount: number;                  // grossAmount - withholdingTax
  currency: CurrencyCode;             // Měna vyplacené dividendy (USD, EUR, CZK)
  fxRateToCZK: number;                // Směnný kurz v den transakce / importu
  grossAmountCZK: number;
  withholdingTaxCZK: number;
  netAmountCZK: number;
  comment?: string;
}

export interface MonthlyDividendAggregate {
  yearMonth: string;                  // "2024-05"
  totalNetCZK: number;
  totalGrossCZK: number;
  totalTaxCZK: number;
  byCurrency: Record<CurrencyCode, number>;
  transactionsCount: number;
}

export type DividendPeriod = 'ALL' | 'YTD' | '1Y' | '3Y' | string; // e.g. "2026", "2025"

export interface AnnualDividendAggregate {
  year: string;                       // "2026", "2025", ...
  isYTD: boolean;                     // true pokud je to aktuální rok
  totalNetCZK: number;
  totalGrossCZK: number;
  totalTaxCZK: number;
  effectiveTaxRate: number;
  transactionsCount: number;
  monthlyAverageCZK: number;          // Průměr na měsíc v daném roce
  yoyGrowthPercent?: number;          // Meziroční růst v % oproti předchozímu roku
}

export interface HoldingDividendSummary {
  normalizedTicker: string;
  name: string;
  totalNetCZK: number;
  totalGrossCZK: number;
  totalTaxCZK: number;
  effectiveTaxRate: number;           // např. 15.0 %
  yieldOnCost: number;                // (Roční čistá dividenda / Pořizovací cena) * 100
  lastPaymentDate?: string;
}
