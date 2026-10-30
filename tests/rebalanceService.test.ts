import { describe, it, expect } from 'vitest';
import { RebalanceService, RebalanceTarget } from '@/lib/services/rebalanceService';

describe('Rebalance Service (KKT Water-Filling)', () => {
  it('correctly allocates new cash strictly to underweight assets', () => {
    // Current portfolio: Total 100k
    // Asset A: 70k (Current: 70%, Target: 50%) -> Overweight
    // Asset B: 30k (Current: 30%, Target: 50%) -> Underweight
    // Inflow: 40k -> New Total = 140k -> Ideal 70k each
    const targets: RebalanceTarget[] = [
      { id: 'a', name: 'Asset A', currentValue: 70000, targetWeight: 0.5 },
      { id: 'b', name: 'Asset B', currentValue: 30000, targetWeight: 0.5 },
    ];

    const result = RebalanceService.calculateBuyOnly(targets, 40000);

    const orderA = result.find(r => r.id === 'a')!;
    const orderB = result.find(r => r.id === 'b')!;

    // Overweight asset A receives 0 cash
    expect(orderA.cashToAdd).toBe(0);
    expect(orderA.postValue).toBe(70000);
    expect(orderA.postWeight).toBeCloseTo(0.5, 2);

    // Underweight asset B receives all 40k
    expect(orderB.cashToAdd).toBe(40000);
    expect(orderB.postValue).toBe(70000);
    expect(orderB.postWeight).toBeCloseTo(0.5, 2);
  });

  it('allocates cash across 3 assets with different underweights', () => {
    const targets: RebalanceTarget[] = [
      { id: 'sp500', name: 'S&P 500', currentValue: 60000, targetWeight: 0.6 },
      { id: 'allworld', name: 'All-World', currentValue: 20000, targetWeight: 0.3 },
      { id: 'gold', name: 'Gold', currentValue: 20000, targetWeight: 0.1 }, // Overweight (20% vs 10%)
    ];

    // Total 100k, new cash 20k -> new total 120k
    // S&P 500 target: 0.6 * 120k = 72k (current 60k -> needs 12k)
    // All-World target: 0.3 * 120k = 36k (current 20k -> needs 16k)
    // Gold target: 0.1 * 120k = 12k (current 20k -> 0 add)
    const result = RebalanceService.calculateBuyOnly(targets, 20000);

    const gold = result.find(r => r.id === 'gold')!;
    expect(gold.cashToAdd).toBe(0);

    const totalAdded = result.reduce((sum, r) => sum + r.cashToAdd, 0);
    expect(totalAdded).toBeCloseTo(20000, 1);
  });
});
