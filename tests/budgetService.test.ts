import { describe, expect, it } from 'bun:test';
import { BudgetService } from '@/lib/services/budgetService';
import { ExpenseCategory, SalaryConfig, WealthProjectionConfig } from '@/types/budget';

describe('Budget, Cashflow & Wealth Simulation Service (Senior Engineering Test Suite)', () => {
  const mockSalary: SalaryConfig = {
    profileId: 'prof-test',
    baseMonthlyNetSalaryCZK: 80000,
    paydayDayOfMonth: 15,
    annualIncreasePercentage: 5.0,
    increaseMonth: 1,
    bonuses: [
      { id: 'b-1', name: 'Roční bonus', month: 12, amountNetCZK: 60000, isRecurringAnnual: true },
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockExpenses: ExpenseCategory[] = [
    { id: 'exp-1', profileId: 'prof-test', name: 'Nájem', monthlyAmountCZK: 25000, isEssential: true, colorHex: '#red' },
    { id: 'exp-2', profileId: 'prof-test', name: 'Jídlo', monthlyAmountCZK: 15000, isEssential: true, colorHex: '#orange' },
    { id: 'exp-3', profileId: 'prof-test', name: 'Předplatné', monthlyAmountCZK: 5000, isEssential: false, colorHex: '#blue' },
  ];

  it('calculates monthly cashflow snapshot and net investable capacity accurately', () => {
    // 60,000 bonus / 12 = 5,000 per month
    // Total income = 80,000 + 5,000 = 85,000
    // Total expenses = 25,000 + 15,000 + 5,000 = 45,000
    // Net investable = 40,000
    // Savings rate = (40,000 / 85,000) * 100 = 47.05%
    const snapshot = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2026-10-10T12:00:00Z'));

    expect(snapshot.monthlyNetSalaryCZK).toBe(80000);
    expect(snapshot.monthlyBonusesCZK).toBe(5000);
    expect(snapshot.totalMonthlyExpensesCZK).toBe(45000);
    expect(snapshot.essentialExpensesCZK).toBe(40000);
    expect(snapshot.discretionaryExpensesCZK).toBe(5000);
    expect(snapshot.netInvestableCapacityCZK).toBe(40000);
    expect(snapshot.savingsRatePercentage).toBeCloseTo(47.1, 1);
    expect(snapshot.daysUntilPayday).toBe(5); // 15 - 10 = 5 days
  });

  describe('Payday countdown calendar invariants', () => {
    it('returns 0 days when today is exactly payday (15th)', () => {
      const snap = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2026-10-15T08:00:00Z'));
      expect(snap.daysUntilPayday).toBe(0);
    });

    it('returns exact days when today is before payday (1st of month)', () => {
      const snap = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2026-10-01T08:00:00Z'));
      expect(snap.daysUntilPayday).toBe(14);
    });

    it('wraps around month boundary accurately in a 31-day month (January 20 -> Feb 15)', () => {
      // Jan has 31 days. Jan 20: 31 - 20 = 11 days left in Jan + 15 days in Feb = 26 days
      const snap = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2026-01-20T12:00:00Z'));
      expect(snap.daysUntilPayday).toBe(26);
    });

    it('wraps around month boundary accurately in a 28-day February (Feb 16 -> Mar 15)', () => {
      // 2025 is not a leap year. Feb has 28 days. Feb 16: 28 - 16 = 12 days in Feb + 15 in Mar = 27 days
      const snap = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2025-02-16T12:00:00Z'));
      expect(snap.daysUntilPayday).toBe(27);
    });

    it('wraps around month boundary accurately in a 30-day month (April 20 -> May 15)', () => {
      // April has 30 days. Apr 20: 30 - 20 = 10 days in Apr + 15 in May = 25 days
      const snap = BudgetService.calculateCashflowSnapshot(mockSalary, mockExpenses, new Date('2026-04-20T12:00:00Z'));
      expect(snap.daysUntilPayday).toBe(25);
    });
  });

  it('guarantees deficit protection: net investable capacity never drops below 0 when expenses exceed salary', () => {
    const hugeExpenses: ExpenseCategory[] = [
      { id: 'exp-huge', profileId: 'prof-test', name: 'Hypotéka', monthlyAmountCZK: 150000, isEssential: true, colorHex: '#red' },
    ];

    const snapshot = BudgetService.calculateCashflowSnapshot(mockSalary, hugeExpenses, new Date());
    expect(snapshot.netInvestableCapacityCZK).toBe(0);
    expect(snapshot.savingsRatePercentage).toBe(0);
  });

  describe('Multi-Horizon Wealth Simulation Invariants', () => {
    it('career escalator strictly steps up every 12 months over 10-year horizon (120 months)', () => {
      const config: WealthProjectionConfig = {
        horizonYears: 10,
        initialNetWorthCZK: 500000,
        monthlyInvestableSurplusCZK: 30000,
        expectedStockReturnPercent: 8.0,
        expectedSalaryGrowthPercent: 5.0, // 5% per year
        expectedExpenseInflationPercent: 2.5,
        dividendYieldPercent: 2.0,
        dripEnabled: true,
        savingsReinvestmentRatePercent: 100,
      };

      const points = BudgetService.simulateWealthProjection(config, mockSalary, mockExpenses);

      expect(points.length).toBe(121); // Month 0 to 120

      // Month 0: Initial starting position
      expect(points[0].portfolioValueCZK).toBe(500000);
      expect(points[0].cumulativeInvestedCZK).toBe(500000);

      // Verify salary step at year boundaries
      const base = 80000;
      // Year 1 (m = 1..12): base
      expect(points[1].salaryCZK).toBe(base);
      expect(points[12].salaryCZK).toBe(base);

      // Year 2 (m = 13..24): base * 1.05 = 84,000
      expect(points[13].salaryCZK).toBe(Math.round(base * 1.05));
      expect(points[24].salaryCZK).toBe(Math.round(base * 1.05));

      // Year 5 (m = 49..60): base * (1.05)^4 = 97,241
      expect(points[49].salaryCZK).toBe(Math.round(base * Math.pow(1.05, 4)));

      // Year 10 (m = 109..120): base * (1.05)^9 = 124,105
      expect(points[120].salaryCZK).toBe(Math.round(base * Math.pow(1.05, 9)));

      // Portfolio value must grow monotonically under positive returns & contributions
      for (let i = 1; i <= 120; i++) {
        expect(points[i].portfolioValueCZK).toBeGreaterThan(points[i - 1].portfolioValueCZK);
        expect(points[i].cumulativeInvestedCZK).toBeGreaterThan(points[i - 1].cumulativeInvestedCZK);
      }
    });

    it('proves DRIP dominance: DRIP reinvestment produces strictly higher net worth than non-DRIP', () => {
      const baseConfig: WealthProjectionConfig = {
        horizonYears: 5,
        initialNetWorthCZK: 200000,
        monthlyInvestableSurplusCZK: 20000,
        expectedStockReturnPercent: 9.0,
        expectedSalaryGrowthPercent: 4.0,
        expectedExpenseInflationPercent: 2.0,
        dividendYieldPercent: 3.0,
        dripEnabled: true,
        savingsReinvestmentRatePercent: 100,
      };

      const dripPoints = BudgetService.simulateWealthProjection(baseConfig, mockSalary, mockExpenses);
      const noDripPoints = BudgetService.simulateWealthProjection({ ...baseConfig, dripEnabled: false }, mockSalary, mockExpenses);

      const finalDrip = dripPoints[dripPoints.length - 1];
      const finalNoDrip = noDripPoints[noDripPoints.length - 1];

      // Final portfolio value with DRIP compounding should be strictly higher
      expect(finalDrip.portfolioValueCZK).toBeGreaterThan(finalNoDrip.portfolioValueCZK);
    });

    it('correctly compares Conservative (6%), Realistic (10%), and Optimistic (14%) macro scenarios', () => {
      const config6: WealthProjectionConfig = {
        horizonYears: 5,
        initialNetWorthCZK: 300000,
        monthlyInvestableSurplusCZK: 25000,
        expectedStockReturnPercent: 6.0,
        expectedSalaryGrowthPercent: 3.0,
        expectedExpenseInflationPercent: 3.5,
        dividendYieldPercent: 2.0,
        dripEnabled: true,
        savingsReinvestmentRatePercent: 100,
      };

      const config10: WealthProjectionConfig = { ...config6, expectedStockReturnPercent: 10.0, expectedSalaryGrowthPercent: 5.0 };
      const config14: WealthProjectionConfig = { ...config6, expectedStockReturnPercent: 14.0, expectedSalaryGrowthPercent: 7.0 };

      const p6 = BudgetService.simulateWealthProjection(config6, mockSalary, mockExpenses);
      const p10 = BudgetService.simulateWealthProjection(config10, mockSalary, mockExpenses);
      const p14 = BudgetService.simulateWealthProjection(config14, mockSalary, mockExpenses);

      const v6 = p6[p6.length - 1].portfolioValueCZK;
      const v10 = p10[p10.length - 1].portfolioValueCZK;
      const v14 = p14[p14.length - 1].portfolioValueCZK;

      // Realistic > Conservative and Optimistic > Realistic
      expect(v10).toBeGreaterThan(v6);
      expect(v14).toBeGreaterThan(v10);
    });

    it('accurately splits wealth accumulation into 2 buckets (Investice/Akcie vs. Spořící účet) with distinct returns', () => {
      const splitConfig: WealthProjectionConfig = {
        horizonYears: 5,
        initialNetWorthCZK: 500000,
        monthlyInvestableSurplusCZK: 30000,
        expectedStockReturnPercent: 10.0, // 10% on stocks
        expectedSavingsReturnPercent: 4.0, // 4% on savings account (spořák)
        stockAllocationPercent: 70, // 70% stocks, 30% savings account
        expectedSalaryGrowthPercent: 5.0,
        expectedExpenseInflationPercent: 2.5,
        dividendYieldPercent: 2.0,
        dripEnabled: true,
        savingsReinvestmentRatePercent: 100,
      };

      const points = BudgetService.simulateWealthProjection(splitConfig, mockSalary, mockExpenses);
      expect(points.length).toBe(61); // Month 0 to 60

      // Month 0: Check initial split (70% stocks = 350,000; 30% savings = 150,000)
      const p0 = points[0];
      expect(p0.stocksValueCZK).toBe(350000);
      expect(p0.savingsValueCZK).toBe(150000);
      expect(p0.stocksValueCZK + p0.savingsValueCZK).toBe(p0.portfolioValueCZK);

      // Check invariants across all 60 months
      for (const pt of points) {
        // Total value invariant
        expect(pt.stocksValueCZK + pt.savingsValueCZK).toBe(pt.portfolioValueCZK);
        // Total invested invariant
        expect(pt.stocksInvestedCZK + pt.savingsInvestedCZK).toBe(pt.cumulativeInvestedCZK);
        // Both buckets must grow
        expect(pt.stocksValueCZK).toBeGreaterThanOrEqual(pt.stocksInvestedCZK);
        expect(pt.savingsValueCZK).toBeGreaterThanOrEqual(pt.savingsInvestedCZK);
      }

      // Final point: Stocks with 10% CAGR + dividends must generate significantly higher % return than 4% savings account
      const pFinal = points[points.length - 1];
      const stockGainPct = (pFinal.stocksCompoundGainCZK / pFinal.stocksInvestedCZK) * 100;
      const savingsGainPct = (pFinal.savingsInterestCZK / pFinal.savingsInvestedCZK) * 100;

      expect(stockGainPct).toBeGreaterThan(savingsGainPct);
      expect(pFinal.stocksValueCZK).toBeGreaterThan(pFinal.savingsValueCZK);
      expect(pFinal.savingsInterestCZK).toBeGreaterThan(0);
    });

    it('proves that 100% stock allocation outperforms 100% savings allocation over 5 years', () => {
      const base: WealthProjectionConfig = {
        horizonYears: 5,
        initialNetWorthCZK: 300000,
        monthlyInvestableSurplusCZK: 20000,
        expectedStockReturnPercent: 10.0,
        expectedSavingsReturnPercent: 3.5,
        expectedSalaryGrowthPercent: 4.0,
        expectedExpenseInflationPercent: 2.5,
        dividendYieldPercent: 2.0,
        dripEnabled: true,
        savingsReinvestmentRatePercent: 100,
      };

      const allStocks = BudgetService.simulateWealthProjection({ ...base, stockAllocationPercent: 100 }, mockSalary, mockExpenses);
      const allSavings = BudgetService.simulateWealthProjection({ ...base, stockAllocationPercent: 0 }, mockSalary, mockExpenses);

      const finalStocks = allStocks[allStocks.length - 1];
      const finalSavings = allSavings[allSavings.length - 1];

      // Principal invested is identical
      expect(finalStocks.cumulativeInvestedCZK).toBe(finalSavings.cumulativeInvestedCZK);

      // Total wealth is strictly higher in stocks due to CAGR difference
      expect(finalStocks.portfolioValueCZK).toBeGreaterThan(finalSavings.portfolioValueCZK);
      expect(finalSavings.savingsValueCZK).toBe(finalSavings.portfolioValueCZK);
      expect(finalStocks.stocksValueCZK).toBe(finalStocks.portfolioValueCZK);
    });
  });
});
