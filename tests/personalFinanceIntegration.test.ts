import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { FileSnapshot } from '@/types/broker';
import { DividendService } from '@/lib/services/dividendService';
import { BudgetService } from '@/lib/services/budgetService';
import { CurrencyDecompositionService } from '@/lib/services/currencyDecompositionService';
import { ExpenseCategory, SalaryConfig, WealthProjectionConfig } from '@/types/budget';
import { Holding, PositionLot } from '@/types/portfolio';

describe('Comprehensive Personal Finance & Wealth Integration Pipeline', () => {
  it('executes full end-to-end data pipeline from broker statement to wealth projection', async () => {
    // 1. Ingest real XTB statement with Open Positions and Cash Operations (Dividends)
    const filePath = 'sample_data/XTB_USD_2235930.xlsx';
    if (!fs.existsSync(filePath)) return;

    const buffer = fs.readFileSync(filePath);
    const snapshot: FileSnapshot = {
      fileName: 'XTB_USD_2235930.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.byteLength,
      data: new Uint8Array(buffer).buffer,
    };

    const adapter = new XtbAdapter();
    const ingestion = await adapter.parse(snapshot);

    expect(ingestion.account.brokerId).toBe('XTB');
    expect(ingestion.holdings.length).toBeGreaterThan(0);
    expect(ingestion.lots.length).toBeGreaterThan(0);
    expect(ingestion.dividends).toBeDefined();
    expect(ingestion.dividends!.length).toBeGreaterThan(0);

    // 2. Process Dividends: Monthly timeline and YoC
    const monthlyDividends = DividendService.aggregateByMonth(ingestion.dividends!);
    expect(monthlyDividends.length).toBeGreaterThan(0);

    const overallDividendSummary = DividendService.calculateOverallSummary(ingestion.dividends!);
    expect(overallDividendSummary.totalNetCZK).toBeGreaterThan(0);
    expect(overallDividendSummary.totalGrossCZK).toBeGreaterThanOrEqual(overallDividendSummary.totalNetCZK);
    expect(overallDividendSummary.effectiveTaxRate).toBeGreaterThan(0);

    // 3. Configure User Employment & Monthly Budget
    const userSalary: SalaryConfig = {
      profileId: 'lukas_main',
      baseMonthlyNetSalaryCZK: 85000,
      paydayDayOfMonth: 15,
      annualIncreasePercentage: 5.0,
      increaseMonth: 1,
      bonuses: [
        { id: 'b-13', name: '13. plat', month: 11, amountNetCZK: 50000, isRecurringAnnual: true },
      ],
      updatedAt: new Date().toISOString(),
    };

    const userExpenses: ExpenseCategory[] = [
      { id: 'e-1', profileId: 'lukas_main', name: 'Bydlení', monthlyAmountCZK: 25000, isEssential: true, colorHex: '#red' },
      { id: 'e-2', profileId: 'lukas_main', name: 'Jídlo', monthlyAmountCZK: 12000, isEssential: true, colorHex: '#orange' },
      { id: 'e-3', profileId: 'lukas_main', name: 'Služby & Net', monthlyAmountCZK: 6000, isEssential: true, colorHex: '#blue' },
      { id: 'e-4', profileId: 'lukas_main', name: 'Zábava', monthlyAmountCZK: 7000, isEssential: false, colorHex: '#purple' },
    ];

    const cashflow = BudgetService.calculateCashflowSnapshot(userSalary, userExpenses, new Date('2026-10-10T12:00:00Z'));
    expect(cashflow.monthlyNetSalaryCZK).toBe(85000);
    expect(cashflow.totalMonthlyExpensesCZK).toBe(50000);
    // Salary 85k + 50k bonus/12 (~4,166) - Expenses 50k = ~39,166 CZK
    expect(cashflow.netInvestableCapacityCZK).toBeGreaterThan(35000);
    expect(cashflow.savingsRatePercentage).toBeGreaterThan(40);
    expect(cashflow.daysUntilPayday).toBe(5);

    // 4. Compute Daily Returns & Algebraic Currency Decomposition
    const mockHoldings: Holding[] = ingestion.holdings.slice(0, 5).map((h, idx) => ({
      id: `acc:${h.rawTicker}`,
      accountId: 'xtb-usd',
      brokerId: 'XTB',
      rawTicker: h.rawTicker,
      normalizedTicker: h.rawTicker.replace('.US', ''),
      name: h.name,
      assetClass: h.assetClass,
      instrumentCurrency: h.instrumentCurrency,
      totalQuantity: 10,
      averageOpenPrice: h.reportedCurrentPrice ? h.reportedCurrentPrice * 0.9 : 100,
      currentPrice: h.reportedCurrentPrice || 110,
      previousClosePrice: h.reportedCurrentPrice ? h.reportedCurrentPrice * 0.98 : 105,
      lastPriceUpdate: new Date().toISOString(),
      tags: [],
    }));

    const mockLots: PositionLot[] = mockHoldings.map((h, idx) => ({
      id: `lot-${idx}`,
      accountId: 'xtb-usd',
      holdingId: h.id,
      ticketId: `t-${idx}`,
      type: 'BUY',
      quantity: 10,
      openPrice: h.averageOpenPrice,
      openDateUtc: '2023-01-01T00:00:00Z',
      instrumentCurrency: h.instrumentCurrency,
    }));

    const rates = { USD: 24.5, EUR: 25.2, CZK: 1.0, GBP: 29.5 };
    const dailyChanges = CurrencyDecompositionService.calculateHoldingDailyChanges(mockHoldings, rates);
    expect(dailyChanges.length).toBe(mockHoldings.length);
    for (const d of dailyChanges) {
      expect(Number.isFinite(d.dailyGainCZK)).toBe(true);
      expect(Number.isFinite(d.dailyChangePercent)).toBe(true);
    }

    const currencyAttribution = CurrencyDecompositionService.calculateCurrencyAttribution(mockHoldings, mockLots, rates);
    expect(currencyAttribution.length).toBeGreaterThan(0);
    for (const b of currencyAttribution) {
      const sum = b.pureAssetGainCZK + b.pureFxGainCZK + b.crossTermCZK;
      expect(sum).toBeCloseTo(b.totalGainCZK, 1);
    }

    // 5. Multi-Horizon Wealth Simulation
    const totalPortfolioValue = dailyChanges.reduce((sum, h) => sum + h.totalValueCZK, 0);
    const wealthConfig: WealthProjectionConfig = {
      horizonYears: 5,
      initialNetWorthCZK: totalPortfolioValue,
      monthlyInvestableSurplusCZK: cashflow.netInvestableCapacityCZK,
      expectedStockReturnPercent: 10.0,
      expectedSalaryGrowthPercent: 5.0,
      expectedExpenseInflationPercent: 2.5,
      dividendYieldPercent: 2.0,
      dripEnabled: true,
      savingsReinvestmentRatePercent: 100,
    };

    const projectionPoints = BudgetService.simulateWealthProjection(wealthConfig, userSalary, userExpenses);
    expect(projectionPoints.length).toBe(61); // Month 0 to 60

    const initialPoint = projectionPoints[0];
    const finalPoint = projectionPoints[60];

    expect(initialPoint.portfolioValueCZK).toBe(Math.round(totalPortfolioValue));
    expect(finalPoint.portfolioValueCZK).toBeGreaterThan(initialPoint.portfolioValueCZK);
    expect(finalPoint.compoundGrowthCZK).toBeGreaterThan(0);
    expect(finalPoint.reinvestedDividendsCZK).toBeGreaterThan(0);
    expect(finalPoint.cumulativeInvestedCZK).toBeGreaterThan(initialPoint.cumulativeInvestedCZK);
  });
});
