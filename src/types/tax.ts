import { BrokerId, CurrencyCode } from './portfolio';

export type ExchangeRateMethod = 'GFR_UNIFORM' | 'CNB_DAILY';

export interface TaxSecuritiesSaleItem {
  id: string;
  ticker: string;
  name: string;
  isin?: string;
  brokerId: BrokerId;
  currency: CurrencyCode;

  volume: number;
  openDateUtc: string;
  closeDateUtc: string;
  holdingPeriodDays: number;
  isTimeTestExempt: boolean; // holdingPeriodDays >= 1096

  salePriceNative: number;
  grossSaleNative: number;
  grossSaleCZK: number;

  openPriceNative: number;
  purchaseCostNative: number;
  purchaseCostCZK: number;

  feeNative: number;
  feeCZK: number;

  netProfitNative: number;
  netProfitCZK: number;
  isProfitable: boolean;

  fxRateUsed: number;
  rateMethodUsed: ExchangeRateMethod;
}

export interface TaxSecuritiesSummary {
  taxYear: number;
  rateMethod: ExchangeRateMethod;

  // Revenue totals
  totalGrossSalesAllCZK: number;
  exemptGrossSalesTimeTestCZK: number; // § 4 odst. 1 písm. w) ZDP
  nonExemptGrossSalesCZK: number;

  // § 4 odst. 1 písm. v) ZDP - 100 000 CZK threshold
  isUnder100kLimit: boolean;
  remaining100kCapacityCZK: number;

  // Tax Base calculation for Příloha č. 2 (§ 10 ZDP)
  taxableGrossRevenueCZK: number; // 0 if under 100k, else nonExemptGrossSalesCZK
  deductiblePurchaseCostsCZK: number;
  deductibleFeesCZK: number;
  netSecuritiesResultCZK: number;
  taxBaseSecuritiesCZK: number; // Max(0, netResult) - losses cannot offset salary
  estimatedTaxSecuritiesCZK: number; // 15% of tax base

  // Tax Alpha & Savings
  taxSavedByTimeTestCZK: number; // 15% of exempt profits
  taxSavedBy100kLimitCZK: number; // 15% of sub-100k non-exempt profits

  // § 38v ZDP Notification duty (> 5M CZK exempt income)
  has5MNotificationDuty: boolean;
  exemptSalesOver5MCZK: TaxSecuritiesSaleItem[];
}

export interface TaxDividendCountrySummary {
  countryCode: string; // e.g. "US", "DE", "IE", "NL", "CZ"
  countryName: string;
  grossDividendsCZK: number;
  foreignTaxPaidCZK: number;
  effectiveForeignTaxRate: number; // e.g. 15% for US, 26.375% for DE
  dttAllowedCreditRate: number; // e.g. 15% under Double Tax Treaty
  allowedCreditCZK: number; // max deductible in CZ
  czechTaxGrossCZK: number; // 15% of gross
  czechTaxDueCZK: number; // max(0, czechTaxGross - allowedCredit)
}

export interface TaxDividendsSummary {
  taxYear: number;
  totalGrossForeignDividendsCZK: number;
  totalForeignTaxPaidCZK: number;
  totalAllowedCreditCZK: number;
  netCzechTaxOnDividendsCZK: number;
  countryBreakdown: TaxDividendCountrySummary[];
}

export interface AnnualTaxReport {
  taxYear: number;
  rateMethod: ExchangeRateMethod;
  generatedAt: string;
  securities: TaxSecuritiesSummary;
  dividends: TaxDividendsSummary;
  totalEstimatedTaxDueCZK: number;
  totalTaxSavingsCZK: number;
  salesItems: TaxSecuritiesSaleItem[];
}
