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

  it('calculates dispersion / volatility confidence cone (±5% p.a. default) widening monotonically over time', () => {
    const initialCapital = 200_000;
    const monthlyDCA = 20_000;
    const returnCAGR = 0.10; // 10% p.a.
    const dispersionPct = 5.0; // ±5% p.a.

    const points = FireService.generateProjection(
      initialCapital,
      monthlyDCA,
      returnCAGR,
      0.025,
      10,
      {
        stockAllocationPct: 70,
        savingsNominalReturn: 0.04,
        maxSavingsBalanceCZK: 500_000,
        annualReturnDispersionPct: dispersionPct,
      }
    );

    expect(points.length).toBeGreaterThan(1);

    // Month 0: bounds must equal exact nominal value (no past volatility yet)
    const p0 = points[0];
    expect(p0.varianceUpperValue).toBe(p0.nominalValue);
    expect(p0.varianceLowerValue).toBe(p0.nominalValue);
    expect(p0.dispersionPercent).toBe(5.0);

    let prevSpread = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      expect(p.varianceUpperValue).toBeDefined();
      expect(p.varianceLowerValue).toBeDefined();

      // Upper boundary strictly greater than nominal, lower boundary strictly less than nominal
      expect(p.varianceUpperValue!).toBeGreaterThan(p.nominalValue);
      expect(p.varianceLowerValue!).toBeLessThan(p.nominalValue);

      // Invariant: variance envelope spread monotonically widens as compounding horizon expands
      const spread = p.varianceUpperValue! - p.varianceLowerValue!;
      expect(spread).toBeGreaterThan(prevSpread);
      prevSpread = spread;
    }

    // Verify projection without dispersion has undefined bounds
    const pointsNoDispersion = FireService.generateProjection(
      initialCapital,
      monthlyDCA,
      returnCAGR,
      0.025,
      5
    );
    expect(pointsNoDispersion[0].varianceUpperValue).toBeUndefined();
    expect(pointsNoDispersion[0].varianceLowerValue).toBeUndefined();
  });

  describe('Comprehensive Multi-Tier FIRE Engine (Lean, Standard, Fat, Barista, Coast, Runway)', () => {
    it('calculates Lean, Standard, Fat, and Barista FIRE targets accurately', () => {
      const res = FireService.calculateComprehensiveFIRE({
        currentPortfolioValue: 2_000_000,
        monthlyDCA: 30_000,
        annualNominalReturn: 0.08,
        swrAnnualRatePct: 3.5, // 3.5% modern SWR
        essentialMonthlyExpenses: 30_000,
        totalMonthlyExpenses: 50_000,
        baristaPartTimeIncome: 20_000,
        fatBufferPct: 35,
      });

      // 1. Lean FIRE (30k/mo -> 360k/yr -> 360k / 0.035 = 10,285,714)
      expect(res.tiers.lean.monthlyExpenseCZK).toBe(30_000);
      expect(res.tiers.lean.targetPortfolioCZK).toBe(Math.round((30_000 * 12) / 0.035));
      expect(res.tiers.lean.progressPercentage).toBeGreaterThan(0);

      // 2. Standard FIRE (50k/mo -> 600k/yr -> 600k / 0.035 = 17,142,857)
      expect(res.tiers.standard.monthlyExpenseCZK).toBe(50_000);
      expect(res.tiers.standard.targetPortfolioCZK).toBe(Math.round((50_000 * 12) / 0.035));
      expect(res.tiers.standard.yearsToFIRE).toBeGreaterThan(res.tiers.lean.yearsToFIRE);

      // 3. Fat FIRE (50k * 1.35 = 67.5k/mo -> 810k/yr -> 810k / 0.035 = 23,142,857)
      expect(res.tiers.fat.monthlyExpenseCZK).toBe(67_500);
      expect(res.tiers.fat.targetPortfolioCZK).toBe(Math.round((67_500 * 12) / 0.035));
      expect(res.tiers.fat.yearsToFIRE).toBeGreaterThan(res.tiers.standard.yearsToFIRE);

      // 4. Barista FIRE (50k - 20k = 30k/mo net withdrawal needed)
      expect(res.tiers.barista.monthlyExpenseCZK).toBe(30_000);
      expect(res.tiers.barista.targetPortfolioCZK).toBe(res.tiers.lean.targetPortfolioCZK);
    });

    it('calculates Coast FIRE capital requirement and coasting threshold', () => {
      const targetRetirement = 15_000_000;
      const currentAge = 30;
      const retirementAge = 60; // 30 years horizon
      const realReturn = 5.0; // 5% real p.a.

      const coast = FireService.calculateCoastFIRE(
        4_000_000,
        targetRetirement,
        realReturn,
        currentAge,
        retirementAge
      );

      // (1 + 0.05)^30 = 4.32194
      // Required = 15,000,000 / 4.32194 = ~3,470,662 CZK
      expect(coast.yearsToRetirement).toBe(30);
      expect(coast.requiredCapitalTodayCZK).toBeLessThan(4_000_000);
      expect(coast.isCoastingAchieved).toBe(true);
      expect(coast.surplusOrShortfallCZK).toBeGreaterThan(0);

      // Verify non-coasting scenario
      const notCoasting = FireService.calculateCoastFIRE(
        1_000_000,
        targetRetirement,
        realReturn,
        currentAge,
        retirementAge
      );
      expect(notCoasting.isCoastingAchieved).toBe(false);
      expect(notCoasting.surplusOrShortfallCZK).toBeLessThan(0);
    });

    it('calculates Liquid Runway months and status thresholds', () => {
      // 1. Critical (< 3 months)
      const critical = FireService.calculateLiquidRunway(50_000, 20_000, 30_000);
      expect(critical.totalRunwayMonths).toBe(1.7);
      expect(critical.runwayStatus).toBe('critical');

      // 2. Healthy (3 - 12 months)
      const healthy = FireService.calculateLiquidRunway(200_000, 20_000, 30_000);
      expect(healthy.totalRunwayMonths).toBe(6.7);
      expect(healthy.essentialRunwayMonths).toBe(10.0);
      expect(healthy.runwayStatus).toBe('healthy');

      // 3. Exceptional (> 12 months)
      const exceptional = FireService.calculateLiquidRunway(500_000, 20_000, 30_000);
      expect(exceptional.totalRunwayMonths).toBe(16.7);
      expect(exceptional.runwayStatus).toBe('exceptional');
    });

    it('detects Crossover Point where passive returns exceed monthly expenses', () => {
      const projection = FireService.generateProjection(5_000_000, 20_000, 0.10, 0.025, 5);
      const crossover = FireService.calculateCrossoverPoint(projection, 40_000, 0.10);

      expect(crossover.hasReached).toBe(true);
      expect(crossover.crossoverMonth).toBeDefined();
      expect(crossover.monthlyPassiveGainCZK).toBeGreaterThanOrEqual(40_000);
    });

    it('simulates Decumulation retirement phase with inflation and stress test protection', () => {
      // Normal decumulation: 10M CZK, 40k/mo withdrawal, 7% return, 2.5% inflation over 30 years
      const normalPoints = FireService.simulateDecumulation({
        initialPortfolioCZK: 10_000_000,
        initialCashCushionCZK: 500_000,
        monthlyWithdrawalCZK: 40_000,
        annualInflationPct: 2.5,
        annualNominalReturnPct: 7.0,
        horizonYears: 30,
        stressTestEnabled: false,
      });

      expect(normalPoints.length).toBeGreaterThan(1);
      const lastNormal = normalPoints[normalPoints.length - 1];
      expect(lastNormal.isBankrupt).toBe(false);
      expect(lastNormal.totalWealthCZK).toBeGreaterThan(0);
      expect(lastNormal.cumulativeWithdrawnCZK).toBeGreaterThan(14_000_000);

      // Stress test: Sequence of Returns crash in Year 1 (-25%) and Year 2 (-15%)
      const stressPoints = FireService.simulateDecumulation({
        initialPortfolioCZK: 5_000_000,
        initialCashCushionCZK: 1_000_000, // 1M cash cushion
        monthlyWithdrawalCZK: 40_000,
        annualInflationPct: 2.5,
        annualNominalReturnPct: 7.0,
        horizonYears: 20,
        stressTestEnabled: true,
      });

      expect(stressPoints.length).toBeGreaterThan(1);
      // In year 1 and 2, cash cushion was used to defend equities
      const y1 = stressPoints.find(p => p.year === 1);
      expect(y1).toBeDefined();
      expect(y1!.cashCushionCZK).toBeLessThan(1_000_000);
    });
  });
});
