import { describe, it, expect } from 'vitest';
import { TaxLossHarvestingService } from '@/lib/services/taxLossHarvestingService';
import { Account, Holding, PositionLot } from '@/types/portfolio';
import { AnnualTaxReport } from '@/types/tax';

describe('TaxLossHarvestingService (Czech Tax Optimization & Safety Guards)', () => {
  const refDate = new Date('2026-11-03T12:00:00Z');

  const accounts: Account[] = [
    {
      id: 'xtb-1',
      brokerId: 'XTB',
      accountNumber: '1726393',
      name: 'XTB CZK Hlavní',
      baseCurrency: 'CZK',
      cashBalances: { CZK: 10000, USD: 0, EUR: 0, GBP: 0 },
      lastImportAt: refDate.toISOString(),
    },
    {
      id: 'deg-1',
      brokerId: 'DEGIRO',
      accountNumber: 'DEG-9921',
      name: 'DEGIRO EUR',
      baseCurrency: 'EUR',
      cashBalances: { CZK: 0, USD: 0, EUR: 500, GBP: 0 },
      lastImportAt: refDate.toISOString(),
    },
  ];

  const holdings: Holding[] = [
    {
      id: 'h-intc',
      accountId: 'xtb-1',
      brokerId: 'XTB',
      rawTicker: 'INTC.US',
      normalizedTicker: 'INTC',
      name: 'Intel Corporation',
      assetClass: 'EQUITY',
      instrumentCurrency: 'USD',
      totalQuantity: 100,
      averageOpenPrice: 50.0,
      currentPrice: 22.0, // Significant loss
      lastPriceUpdate: refDate.toISOString(),
      tags: ['US Tech'],
    },
    {
      id: 'h-sxr8',
      accountId: 'xtb-1',
      brokerId: 'XTB',
      rawTicker: 'SXR8.DE',
      normalizedTicker: 'SXR8',
      name: 'iShares Core S&P 500',
      assetClass: 'ETF',
      instrumentCurrency: 'EUR',
      totalQuantity: 20,
      averageOpenPrice: 400.0,
      currentPrice: 580.0, // Profit
      lastPriceUpdate: refDate.toISOString(),
      tags: ['S&P 500'],
    },
    {
      id: 'h-pypl',
      accountId: 'deg-1',
      brokerId: 'DEGIRO',
      rawTicker: 'PYPL',
      normalizedTicker: 'PYPL',
      name: 'PayPal Holdings',
      assetClass: 'EQUITY',
      instrumentCurrency: 'USD',
      totalQuantity: 50,
      averageOpenPrice: 90.0,
      currentPrice: 60.0, // Loss
      lastPriceUpdate: refDate.toISOString(),
      tags: ['Fintech'],
    },
  ];

  it('correctly filters candidates younger than 3 years in loss, and STRICTLY EXCLUDES exempt lots >= 3 years', () => {
    const lots: PositionLot[] = [
      // 1. Loss lot, held 1.5 years (~540 days) -> VALID CANDIDATE
      {
        id: 'lot-intc-young',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 't1',
        type: 'BUY',
        quantity: 50,
        openPrice: 50.0, // current 22.0 -> loss $28 * 50 = -$1400 (~ -32k CZK)
        openDateUtc: '2025-05-10T10:00:00Z',
        instrumentCurrency: 'USD',
      },
      // 2. Loss lot, held 3.5 years (~1280 days) -> TIME TEST EXEMPT -> LOSS IS NON-DEDUCTIBLE -> EXCLUDED!
      {
        id: 'lot-intc-old-exempt',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 't2',
        type: 'BUY',
        quantity: 50,
        openPrice: 60.0, // current 22.0 -> big loss but held > 3 years!
        openDateUtc: '2023-04-01T10:00:00Z',
        instrumentCurrency: 'USD',
      },
      // 3. Profitable lot, held 1 year -> EXCLUDED from harvest
      {
        id: 'lot-sxr8-profit',
        accountId: 'xtb-1',
        holdingId: 'h-sxr8',
        ticketId: 't3',
        type: 'BUY',
        quantity: 10,
        openPrice: 400.0,
        openDateUtc: '2025-11-01T10:00:00Z',
        instrumentCurrency: 'EUR',
      },
      // 4. Loss lot on DEGIRO, held 200 days -> VALID CANDIDATE
      {
        id: 'lot-pypl-young',
        accountId: 'deg-1',
        holdingId: 'h-pypl',
        ticketId: 't4',
        type: 'BUY',
        quantity: 50,
        openPrice: 90.0, // current 60.0 -> loss $30 * 50 = -$1500
        openDateUtc: '2026-04-15T10:00:00Z',
        instrumentCurrency: 'USD',
      },
    ];

    const candidates = TaxLossHarvestingService.findCandidates(holdings, lots, accounts, 'CZK', refDate);

    // Only lot-intc-young and lot-pypl-young qualify
    expect(candidates.length).toBe(2);
    expect(candidates.some((c) => c.lotId === 'lot-intc-young')).toBe(true);
    expect(candidates.some((c) => c.lotId === 'lot-pypl-young')).toBe(true);

    // lot-intc-old-exempt MUST NOT be in candidates!
    expect(candidates.some((c) => c.lotId === 'lot-intc-old-exempt')).toBe(false);

    // Candidates have positive potential tax savings (15% of loss)
    for (const c of candidates) {
      expect(c.unrealizedLossCZK).toBeLessThan(0);
      expect(c.potentialTaxSavingsCZK).toBeGreaterThan(0);
      expect(c.holdingDays).toBeLessThan(1096);
      expect(c.daysToTimeTest).toBeGreaterThan(0);
    }
  });

  it('ranks candidates by loss density so greatest loss per gross proceeds is prioritized', () => {
    const lots: PositionLot[] = [
      // Lot A: Loss 10%, price 100 -> 90. Loss = 10, Value = 90. Density = 10 / 90 = 0.11
      {
        id: 'lot-a',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 'tA',
        type: 'BUY',
        quantity: 10,
        openPrice: 25.0, // current 22.0 -> loss $3 * 10 = -$30
        openDateUtc: '2026-01-01T10:00:00Z',
        instrumentCurrency: 'USD',
      },
      // Lot B: Loss 60%, price 55 -> 22. Loss = 33, Value = 22. Density = 33 / 22 = 1.50
      {
        id: 'lot-b',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 'tB',
        type: 'BUY',
        quantity: 10,
        openPrice: 55.0, // current 22.0 -> loss $33 * 10 = -$330
        openDateUtc: '2026-02-01T10:00:00Z',
        instrumentCurrency: 'USD',
      },
    ];

    const candidates = TaxLossHarvestingService.findCandidates(holdings, lots, accounts, 'CZK', refDate);
    expect(candidates.length).toBe(2);
    expect(candidates[0].lotId).toBe('lot-b'); // higher density first
    expect(candidates[1].lotId).toBe('lot-a');
    expect(candidates[0].lossDensity).toBeGreaterThan(candidates[1].lossDensity);
  });

  it('provides smart ETF substitutes for common indexes to prevent wash sale challenges', () => {
    const sxr8Sub = TaxLossHarvestingService.getSubstitute('SXR8.DE');
    expect(sxr8Sub).toBeDefined();
    expect(sxr8Sub?.ticker).toBe('VUAA.UK');
    expect(sxr8Sub?.isin).toBe('IE00BFMXXD54');

    const vuaaSub = TaxLossHarvestingService.getSubstitute('VUAA');
    expect(vuaaSub?.ticker).toBe('SXR8.DE');

    const vwceSub = TaxLossHarvestingService.getSubstitute('VWCE.DE');
    expect(vwceSub?.ticker).toBe('ISAC.L');
  });

  it('simulates harvesting reducing § 10 tax base and tax due accurately', () => {
    // Current report: Gross sales 200k (so > 100k, not exempt), Net realized gain 80 000 CZK, Tax due 12 000 CZK
    const mockReport: AnnualTaxReport = {
      taxYear: 2026,
      rateMethod: 'GFR_UNIFORM',
      generatedAt: refDate.toISOString(),
      securities: {
        taxYear: 2026,
        rateMethod: 'GFR_UNIFORM',
        totalGrossSalesAllCZK: 300_000,
        exemptGrossSalesTimeTestCZK: 100_000,
        nonExemptGrossSalesCZK: 200_000,
        isUnder100kLimit: false,
        remaining100kCapacityCZK: 0,
        taxableGrossRevenueCZK: 200_000,
        deductiblePurchaseCostsCZK: 120_000,
        deductibleFeesCZK: 0,
        netSecuritiesResultCZK: 80_000,
        taxBaseSecuritiesCZK: 80_000,
        estimatedTaxSecuritiesCZK: 12_000, // 15% of 80k
        taxSavedByTimeTestCZK: 15_000,
        taxSavedBy100kLimitCZK: 0,
        has5MNotificationDuty: false,
        exemptSalesOver5MCZK: [],
      },
      dividends: {
        taxYear: 2026,
        totalGrossForeignDividendsCZK: 0,
        totalForeignTaxPaidCZK: 0,
        totalAllowedCreditCZK: 0,
        netCzechTaxOnDividendsCZK: 0,
        domestic: { grossCZK: 0, finalWithholdingTaxPaidCZK: 0, count: 0 },
        countryBreakdown: [],
      },
      brokers: [],
      totalEstimatedTaxDueCZK: 12_000,
      totalTaxSavingsCZK: 15_000,
      salesItems: [],
    };

    const candidate = {
      lotId: 'c1',
      holdingId: 'h-intc',
      accountId: 'xtb-1',
      accountName: 'XTB',
      brokerId: 'XTB' as const,
      symbol: 'INTC',
      name: 'Intel',
      openDateUtc: '2025-06-01T00:00:00Z',
      holdingDays: 520,
      daysToTimeTest: 576,
      quantity: 100,
      openPriceNative: 50,
      currentPriceNative: 22,
      instrumentCurrency: 'USD' as const,
      costBasisCZK: 116_500,
      currentMarketValueCZK: 51_260,
      unrealizedLossCZK: -65_240, // Loss to harvest
      potentialTaxSavingsCZK: 9_786,
      lossDensity: 1.27,
    };

    const sim = TaxLossHarvestingService.simulateHarvest(mockReport, [
      { candidate, harvestQuantity: 100 },
    ]);

    expect(sim.postOptimization.totalLossHarvestedCZK).toBe(65_240);
    expect(sim.postOptimization.newSec10NetResultCZK).toBe(80_000 - 65_240); // 14 760
    expect(sim.postOptimization.newSec10TaxBaseCZK).toBe(14_760);
    expect(sim.postOptimization.newSec10TaxDueCZK).toBe(Math.round(14_760 * 0.15)); // 2 214
    // Net cash saved on tax: 12 000 - 2 214 = 9 786 CZK
    expect(sim.postOptimization.netCashSavedCZK).toBe(12_000 - 2_214);
    expect(sim.postOptimization.isOverHarvested).toBe(false);
    expect(sim.postOptimization.breaks100kCliff).toBe(false);
  });

  it('detects CLIFF PARADOX guard: prevents breaking 100k gross revenue exemption', () => {
    // Current report: Gross sales were 70 000 CZK (UNDER 100k LIMIT -> EXEMPT, tax due = 0)
    // Realized profit was 30 000 CZK, but tax is 0 because under 100k!
    const mockReportUnder100k: AnnualTaxReport = {
      taxYear: 2026,
      rateMethod: 'GFR_UNIFORM',
      generatedAt: refDate.toISOString(),
      securities: {
        taxYear: 2026,
        rateMethod: 'GFR_UNIFORM',
        totalGrossSalesAllCZK: 70_000,
        exemptGrossSalesTimeTestCZK: 0,
        nonExemptGrossSalesCZK: 70_000,
        isUnder100kLimit: true, // EXEMPT!
        remaining100kCapacityCZK: 30_000,
        taxableGrossRevenueCZK: 0,
        deductiblePurchaseCostsCZK: 0,
        deductibleFeesCZK: 0,
        netSecuritiesResultCZK: 30_000,
        taxBaseSecuritiesCZK: 0,
        estimatedTaxSecuritiesCZK: 0,
        taxSavedByTimeTestCZK: 0,
        taxSavedBy100kLimitCZK: 4_500,
        has5MNotificationDuty: false,
        exemptSalesOver5MCZK: [],
      },
      dividends: {
        taxYear: 2026,
        totalGrossForeignDividendsCZK: 0,
        totalForeignTaxPaidCZK: 0,
        totalAllowedCreditCZK: 0,
        netCzechTaxOnDividendsCZK: 0,
        domestic: { grossCZK: 0, finalWithholdingTaxPaidCZK: 0, count: 0 },
        countryBreakdown: [],
      },
      brokers: [],
      totalEstimatedTaxDueCZK: 0,
      totalTaxSavingsCZK: 4_500,
      salesItems: [],
    };

    // Candidate whose sale proceeds are 45 000 CZK (pushes 70k + 45k = 115k > 100k!)
    const candidate = {
      lotId: 'c-cliff',
      holdingId: 'h-intc',
      accountId: 'xtb-1',
      accountName: 'XTB',
      brokerId: 'XTB' as const,
      symbol: 'INTC',
      name: 'Intel',
      openDateUtc: '2026-03-01T00:00:00Z',
      holdingDays: 247,
      daysToTimeTest: 849,
      quantity: 50,
      openPriceNative: 50,
      currentPriceNative: 30,
      instrumentCurrency: 'USD' as const,
      costBasisCZK: 58_250,
      currentMarketValueCZK: 45_000,
      unrealizedLossCZK: -13_250,
      potentialTaxSavingsCZK: 1_988,
      lossDensity: 0.29,
    };

    const sim = TaxLossHarvestingService.simulateHarvest(mockReportUnder100k, [
      { candidate, harvestQuantity: 50 },
    ]);

    // CLIFF DETECTED!
    expect(sim.postOptimization.breaks100kCliff).toBe(true);
    expect(sim.postOptimization.newNonExemptGrossSalesCZK).toBe(115_000); // 70k + 45k > 100k
    // The previous 30k gain minus 13.25k loss leaves 16.75k taxable!
    expect(sim.postOptimization.newSec10TaxDueCZK).toBeGreaterThan(0);
    // User would end up paying MORE tax than before (0 -> ~2513 CZK)!
  });

  it('detects over-harvesting saturation when loss exceeds taxable gains', () => {
    const mockReport: AnnualTaxReport = {
      taxYear: 2026,
      rateMethod: 'GFR_UNIFORM',
      generatedAt: refDate.toISOString(),
      securities: {
        taxYear: 2026,
        rateMethod: 'GFR_UNIFORM',
        totalGrossSalesAllCZK: 200_000,
        exemptGrossSalesTimeTestCZK: 0,
        nonExemptGrossSalesCZK: 200_000,
        isUnder100kLimit: false,
        remaining100kCapacityCZK: 0,
        taxableGrossRevenueCZK: 200_000,
        deductiblePurchaseCostsCZK: 180_000,
        deductibleFeesCZK: 0,
        netSecuritiesResultCZK: 20_000, // Only 20k gain
        taxBaseSecuritiesCZK: 20_000,
        estimatedTaxSecuritiesCZK: 3_000,
        taxSavedByTimeTestCZK: 0,
        taxSavedBy100kLimitCZK: 0,
        has5MNotificationDuty: false,
        exemptSalesOver5MCZK: [],
      },
      dividends: {
        taxYear: 2026,
        totalGrossForeignDividendsCZK: 0,
        totalForeignTaxPaidCZK: 0,
        totalAllowedCreditCZK: 0,
        netCzechTaxOnDividendsCZK: 0,
        domestic: { grossCZK: 0, finalWithholdingTaxPaidCZK: 0, count: 0 },
        countryBreakdown: [],
      },
      brokers: [],
      totalEstimatedTaxDueCZK: 3_000,
      totalTaxSavingsCZK: 0,
      salesItems: [],
    };

    // Candidate has 50 000 CZK loss, but we only have 20 000 CZK gain
    const candidate = {
      lotId: 'c-over',
      holdingId: 'h-intc',
      accountId: 'xtb-1',
      accountName: 'XTB',
      brokerId: 'XTB' as const,
      symbol: 'INTC',
      name: 'Intel',
      openDateUtc: '2026-01-01T00:00:00Z',
      holdingDays: 300,
      daysToTimeTest: 796,
      quantity: 100,
      openPriceNative: 50,
      currentPriceNative: 20,
      instrumentCurrency: 'USD' as const,
      costBasisCZK: 100_000,
      currentMarketValueCZK: 50_000,
      unrealizedLossCZK: -50_000,
      potentialTaxSavingsCZK: 7_500,
      lossDensity: 1.0,
    };

    const sim = TaxLossHarvestingService.simulateHarvest(mockReport, [
      { candidate, harvestQuantity: 100 },
    ]);

    expect(sim.postOptimization.isOverHarvested).toBe(true);
    expect(sim.postOptimization.overHarvestAmountCZK).toBe(30_000); // 50k loss - 20k gain = 30k wasted loss
    expect(sim.postOptimization.newSec10TaxBaseCZK).toBe(0);
    expect(sim.postOptimization.newSec10TaxDueCZK).toBe(0);
    expect(sim.postOptimization.netCashSavedCZK).toBe(3_000); // saved all 3k tax, but cannot save more
  });

  it('identifies upcoming exempt lots nearing 3-year time test', () => {
    const lots: PositionLot[] = [
      // Lot with 30 days left until 3 years (~1066 days old) with gain
      {
        id: 'lot-near-exempt',
        accountId: 'xtb-1',
        holdingId: 'h-sxr8',
        ticketId: 'tNear',
        type: 'BUY',
        quantity: 10,
        openPrice: 400.0,
        openDateUtc: new Date(refDate.getTime() - 1066 * 86_400_000).toISOString(),
        instrumentCurrency: 'EUR',
      },
    ];

    const upcoming = TaxLossHarvestingService.getUpcomingExemptLots(holdings, lots, refDate, 60);
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].daysRemaining).toBe(30);
    expect(upcoming[0].unrealizedGainCZK).toBeGreaterThan(0);
    expect(upcoming[0].taxProtectionValueCZK).toBe(Math.round(upcoming[0].unrealizedGainCZK * 0.15));
  });

  it('correctly groups multiple lots by ticker and performs HIFO simulation', () => {
    // Two INTC loss lots with different prices
    const lots: PositionLot[] = [
      {
        id: 'lot-intc-1',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 't1',
        type: 'BUY',
        quantity: 40,
        openPrice: 40.0, // Loss of (22 - 40) = -18
        openDateUtc: new Date(refDate.getTime() - 200 * 86_400_000).toISOString(),
        instrumentCurrency: 'USD',
      },
      {
        id: 'lot-intc-2',
        accountId: 'xtb-1',
        holdingId: 'h-intc',
        ticketId: 't2',
        type: 'BUY',
        quantity: 60,
        openPrice: 60.0, // Bigger loss of (22 - 60) = -38 (Higher loss density)
        openDateUtc: new Date(refDate.getTime() - 400 * 86_400_000).toISOString(),
        instrumentCurrency: 'USD',
      },
    ];

    const candidates = TaxLossHarvestingService.findCandidates(holdings, lots, accounts, 'CZK', refDate);
    expect(candidates.length).toBe(2);

    const grouped = TaxLossHarvestingService.groupCandidatesByTicker(candidates);
    expect(grouped.length).toBe(1);
    expect(grouped[0].symbol).toBe('INTC.US');
    expect(grouped[0].lotsCount).toBe(2);
    expect(grouped[0].totalLossQuantity).toBe(100);
    expect(grouped[0].lots[0].openPriceNative).toBe(60); // HIFO: 60 is first!
    expect(grouped[0].lots[1].openPriceNative).toBe(40);
  });
});
