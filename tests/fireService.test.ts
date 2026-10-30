import { describe, it, expect } from 'vitest';
import { FireService } from '@/lib/services/fireService';

describe('FIRE & Milestone Simulator', () => {
  it('closed-form milestone N* matches discrete simulation', () => {
    const P0 = 100_000;
    const PMT = 10_000;
    const r = 0.08;
    const target = 1_000_000;

    const res = FireService.monthsToMilestone(P0, PMT, r, target);
    expect(res.reachable).toBe(true);
    expect(res.months).toBeGreaterThan(0);

    // Verify with forward discrete calculation
    let current = P0;
    const j = r / 12;
    for (let m = 1; m <= res.months; m++) {
      current = (current + PMT) * (1 + j);
    }
    // At month N, current must have crossed the target
    expect(current).toBeGreaterThanOrEqual(target);

    // At month N-1, current must be below target
    let prev = P0;
    for (let m = 1; m < res.months; m++) {
      prev = (prev + PMT) * (1 + j);
    }
    expect(prev).toBeLessThan(target);
  });

  it('calculates FIRE target using 4% Safe Withdrawal Rate', () => {
    const desiredMonthlyExpense = 50_000; // 50k Kč/month
    // Annual = 600k Kč. Target = 600k / 0.04 = 15,000,000 Kč
    const fire = FireService.calculateFIRE(100_000, 20_000, 0.08, desiredMonthlyExpense, true);
    expect(fire.firePortfolioTarget).toBe(15_000_000);
    expect(fire.safeMonthlyNetIncome).toBe(50_000);
    expect(fire.monthsToFIRE).toBeGreaterThan(0);
  });

  it('generates multi-year compound projection trajectory', () => {
    const points = FireService.generateProjection(100_000, 10_000, 0.08, 0.025, 5);
    expect(points.length).toBeGreaterThan(0);

    const first = points[0];
    expect(first.year).toBe(0);
    expect(first.nominalValue).toBe(100_000);

    const last = points[points.length - 1];
    expect(last.year).toBe(5);
    expect(last.nominalValue).toBeGreaterThan(last.principalInvested);
    expect(last.compoundInterestGain).toBe(last.nominalValue - last.principalInvested);
  });

  it('generates 2-bucket asset trajectory with separate stocks and savings accounts', () => {
    const points = FireService.generateProjection(
      200_000,
      20_000,
      0.10, // 10% stocks
      0.025,
      5,
      {
        stockAllocationPct: 70, // 70% stocks, 30% savings
        savingsNominalReturn: 0.04, // 4% savings account
      }
    );

    expect(points.length).toBeGreaterThan(0);

    const first = points[0];
    expect(first.stocksValue).toBe(140_000); // 70% of 200k
    expect(first.savingsValue).toBe(60_000);  // 30% of 200k
    expect(first.stocksValue + first.savingsValue).toBe(first.nominalValue);

    const last = points[points.length - 1];
    expect(last.stocksValue + last.savingsValue).toBe(last.nominalValue);
    expect(last.stocksPrincipalInvested + last.savingsPrincipalInvested).toBe(last.principalInvested);
    expect(last.stocksCompoundGain + last.savingsInterestGain).toBe(last.compoundInterestGain);

    // Stocks must yield higher compound gain than savings
    expect(last.stocksCompoundGain / last.stocksPrincipalInvested).toBeGreaterThan(
      last.savingsInterestGain / last.savingsPrincipalInvested
    );
  });

  it('enforces Emergency Cushion Cap (e.g. 500k CZK) and automatically spills surplus into stocks', () => {
    const initialCapital = 300_000;
    const monthlyDCA = 30_000; // 30k/mo
    const cap = 500_000; // 500k cap on savings

    // 1. Projection with 500k cap
    const pointsWithCap = FireService.generateProjection(
      initialCapital,
      monthlyDCA,
      0.10, // 10% stocks
      0.025,
      10, // 10 years
      {
        stockAllocationPct: 50, // 50% stocks (15k), 50% savings (15k)
        savingsNominalReturn: 0.04,
        maxSavingsBalanceCZK: cap,
      }
    );

    // 2. Projection without cap (savings grows unconstrained)
    const pointsWithoutCap = FireService.generateProjection(
      initialCapital,
      monthlyDCA,
      0.10,
      0.025,
      10,
      {
        stockAllocationPct: 50,
        savingsNominalReturn: 0.04,
        // no cap
      }
    );

    // At all points with cap, savingsValue must NEVER exceed 500,000 CZK
    for (const p of pointsWithCap) {
      expect(p.savingsValue).toBeLessThanOrEqual(cap);
      expect(p.stocksValue + p.savingsValue).toBe(p.nominalValue);
      expect(p.stocksPrincipalInvested + p.savingsPrincipalInvested).toBe(p.principalInvested);
    }

    const lastWithCap = pointsWithCap[pointsWithCap.length - 1];
    const lastWithoutCap = pointsWithoutCap[pointsWithoutCap.length - 1];

    // Savings must stay anchored at exactly 500,000 CZK
    expect(lastWithCap.savingsValue).toBe(cap);
    // Without cap, savings would have grown to well over 1.5M
    expect(lastWithoutCap.savingsValue).toBeGreaterThan(1_500_000);

    // Spillover to stocks must have occurred and be tracked
    expect(lastWithCap.savingsSpilloverToStocks).toBeDefined();
    expect(lastWithCap.savingsSpilloverToStocks!).toBeGreaterThan(1_000_000);

    // Total ending wealth and stock portfolio MUST be strictly higher when excess cash spills over to 10% stocks!
    expect(lastWithCap.stocksValue).toBeGreaterThan(lastWithoutCap.stocksValue);
    expect(lastWithCap.nominalValue).toBeGreaterThan(lastWithoutCap.nominalValue);
  });
});
