import { describe, expect, it } from 'bun:test';
import { BudgetService } from '@/lib/services/budgetService';
import { ExpenseCategory, SalaryConfig, WealthProjectionConfig } from '@/types/budget';

describe('Budget, Cashflow & Wealth Simulation Service', () => {
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

  it('calculates monthly cashflow snapshot and net investable capacity', () => {
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

  it('career escalator increases salary after each 12 months', () => {
    const config: WealthProjectionConfig = {
      horizonYears: 3,
      initialNetWorthCZK: 100000,
      monthlyInvestableSurplusCZK: 35000,
      expectedStockReturnPercent: 10.0,
      expectedSalaryGrowthPercent: 10.0, // 10% per year for clean math
      expectedExpenseInflationPercent: 0,
      dividendYieldPercent: 0,
      dripEnabled: false,
      savingsReinvestmentRatePercent: 100,
    };

    const projection = BudgetService.simulateWealthProjection(config, mockSalary, mockExpenses);

    expect(projection.length).toBe(37); // month 0 to 36

    // Year 1 (month 1..12): base salary = 80,000
    expect(projection[1].salaryCZK).toBe(80000);
    expect(projection[12].salaryCZK).toBe(80000);

    // Year 2 (month 13..24): salary increases by 10% -> 88,000
    expect(projection[13].salaryCZK).toBe(88000);
    expect(projection[24].salaryCZK).toBe(88000);

    // Year 3 (month 25..36): salary increases by another 10% -> 96,800
    expect(projection[25].salaryCZK).toBe(96800);
    expect(projection[36].salaryCZK).toBe(96800);

    // Portfolio value grows through monthly contributions and 10% compound return
    expect(projection[36].portfolioValueCZK).toBeGreaterThan(projection[0].portfolioValueCZK);
    expect(projection[36].compoundGrowthCZK).toBeGreaterThan(0);
  });
});
