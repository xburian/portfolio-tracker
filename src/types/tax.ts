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
  countryCode: string; // e.g. "US", "DE", "IE", "NL", "CZ", "GB"
  countryName: string;
  grossDividendsCZK: number;
  foreignTaxPaidCZK: number;
  effectiveForeignTaxRate: number; // e.g. 15% for US, 26.375% for DE
  dttAllowedCreditRate: number; // e.g. 15% under Double Tax Treaty
  allowedCreditCZK: number; // max deductible in CZ
  czechTaxGrossCZK: number; // 15% of gross
  czechTaxDueCZK: number; // max(0, czechTaxGross - allowedCredit)
}

export interface DomesticDividendSummary {
  grossCZK: number;
  finalWithholdingTaxPaidCZK: number; // 15% sražená konečná daň dle § 36 ZDP
  count: number;
}

export interface TaxDividendsSummary {
  taxYear: number;
  totalGrossForeignDividendsCZK: number;
  totalForeignTaxPaidCZK: number;
  totalAllowedCreditCZK: number;
  netCzechTaxOnDividendsCZK: number;
  domestic: DomesticDividendSummary;
  countryBreakdown: TaxDividendCountrySummary[];
}

// -------------------------------------------------------------
// Broker-Level Breakdown (§ 8 and § 10 per broker account)
// -------------------------------------------------------------

export interface BrokerDividendTaxSummary {
  brokerId: BrokerId;
  accountId: string;
  accountName: string;
  
  // Domestic (§ 36)
  domesticGrossCZK: number;
  domesticWithholdingTaxCZK: number;

  // Foreign (§ 8 + Schedule 3)
  foreignGrossCZK: number;
  foreignWithholdingTaxPaidCZK: number;
  foreignAllowableCreditCZK: number;
  czechTaxDueCZK: number; // doplatek FÚ
}

export interface BrokerSalesTaxSummary {
  brokerId: BrokerId;
  accountId: string;
  accountName: string;

  // Exempt (§ 4(1)(w))
  exemptProceedsCZK: number;
  exemptAcquisitionCostCZK: number;
  exemptRealizedGainCZK: number;
  exemptTradesCount: number;

  // Non-exempt (§ 10)
  taxableProceedsCZK: number;
  taxableAcquisitionCostCZK: number;
  taxableCommissionsCZK: number;
  taxableNetResultCZK: number; // can be negative (loss)
  taxableTradesCount: number;
}

export interface BrokerTaxBreakdown {
  brokerId: BrokerId;
  accountId: string;
  accountName: string;
  baseCurrency: CurrencyCode;
  dividends: BrokerDividendTaxSummary;
  sales: BrokerSalesTaxSummary;
  totalCzechTaxDueCZK: number; // tentative broker tax due
}

export interface AnnualTaxReport {
  taxYear: number;
  rateMethod: ExchangeRateMethod;
  generatedAt: string;
  securities: TaxSecuritiesSummary;
  dividends: TaxDividendsSummary;
  brokers: BrokerTaxBreakdown[];
  totalEstimatedTaxDueCZK: number; // total liability payable to FÚ (§ 10 + § 8)
  totalTaxSavingsCZK: number;
  salesItems: TaxSecuritiesSaleItem[];
}

// -------------------------------------------------------------
// Tax-Loss Harvesting (TLH) Candidate & Simulation Types
// -------------------------------------------------------------

export interface EtfSubstituteSuggestion {
  ticker: string;
  name: string;
  isin: string;
  description: string;
}

export interface TaxLossCandidate {
  lotId: string;
  holdingId: string;
  accountId: string;
  accountName: string;
  brokerId: BrokerId;
  symbol: string;
  name: string;
  isin?: string;
  openDateUtc: string;
  holdingDays: number;
  daysToTimeTest: number; // 1096 - holdingDays
  quantity: number;
  openPriceNative: number;
  currentPriceNative: number;
  instrumentCurrency: CurrencyCode;
  costBasisCZK: number;
  currentMarketValueCZK: number;
  unrealizedLossCZK: number; // negative number e.g. -45 000
  potentialTaxSavingsCZK: number; // Math.abs(unrealizedLossCZK) * 0.15
  lossDensity: number; // Math.abs(unrealizedLossCZK) / currentMarketValueCZK
  suggestedSubstitute?: EtfSubstituteSuggestion;
}

export interface TaxHarvestSimulationItem {
  candidate: TaxLossCandidate;
  harvestQuantity: number;
  harvestLossCZK: number;
  harvestProceedsCZK: number;
}

export interface TaxHarvestSimulationResult {
  preOptimization: {
    sec10NetResultCZK: number;
    sec10TaxBaseCZK: number;
    sec10TaxDueCZK: number;
    nonExemptGrossSalesCZK: number;
    isUnder100kLimit: boolean;
  };
  postOptimization: {
    totalLossHarvestedCZK: number;
    totalProceedsGeneratedCZK: number;
    newNonExemptGrossSalesCZK: number;
    newSec10NetResultCZK: number;
    newSec10TaxBaseCZK: number;
    newSec10TaxDueCZK: number;
    netCashSavedCZK: number;
    isOverHarvested: boolean;
    overHarvestAmountCZK: number;
    breaks100kCliff: boolean; // True if pre <= 100k and post > 100k!
  };
  simulationItems: TaxHarvestSimulationItem[];
}
