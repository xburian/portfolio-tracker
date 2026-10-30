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
});
