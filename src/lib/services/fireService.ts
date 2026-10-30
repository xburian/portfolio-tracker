export interface ProjectionDataPoint {
  month: number;
  year: number;
  principalInvested: number;
  nominalValue: number;
  realValue: number;
  compoundInterestGain: number;
}

export interface MilestoneResult {
  targetAmount: number;
  months: number;
  years: number;
  reachable: boolean;
  targetDate: string;
}

export interface FIREResult {
  targetNetMonthlyExpense: number;
  effectiveTaxRate: number;
  firePortfolioTarget: number;
  safeMonthlyGrossWithdrawal: number;
  safeMonthlyNetIncome: number;
  monthsToFIRE: number;
  yearsToFIRE: number;
  fireDate: string;
}

export class FireService {
  /**
   * Closed-form formula: N* = ln( (M*j + PMT*(1+j)) / (P0*j + PMT*(1+j)) ) / ln(1+j)
   */
  static monthsToMilestone(
    initialValue: number,
    monthlyDCA: number,
    annualNominalReturn: number,
    targetMilestone: number
  ): { months: number; years: number; reachable: boolean } {
    if (initialValue >= targetMilestone) {
      return { months: 0, years: 0, reachable: true };
    }

    const j = annualNominalReturn / 12;

    if (j <= 0) {
      if (monthlyDCA <= 0) return { months: Infinity, years: Infinity, reachable: false };
      const m = (targetMilestone - initialValue) / monthlyDCA;
      return { months: Math.ceil(m), years: Math.round((m / 12) * 10) / 10, reachable: true };
    }

    const pmtFactor = monthlyDCA * (1 + j);
    const numerator = targetMilestone * j + pmtFactor;
    const denominator = initialValue * j + pmtFactor;

    if (numerator <= 0 || denominator <= 0) {
      return { months: Infinity, years: Infinity, reachable: false };
    }

    const N = Math.log(numerator / denominator) / Math.log(1 + j);
    const totalMonths = Math.ceil(N);

    return {
      months: totalMonths,
      years: Math.round((totalMonths / 12) * 10) / 10,
      reachable: true,
    };
  }

  static getMilestones(
    initialValue: number,
    monthlyDCA: number,
    annualNominalReturn: number,
    milestoneTargets: number[] = [1_000_000, 3_000_000, 5_000_000, 10_000_000]
  ): MilestoneResult[] {
    const now = new Date();
    return milestoneTargets.map(target => {
      const res = this.monthsToMilestone(initialValue, monthlyDCA, annualNominalReturn, target);
      const targetDate = new Date(now);
      if (res.reachable && isFinite(res.months)) {
        targetDate.setMonth(targetDate.getMonth() + res.months);
      }
      return {
        targetAmount: target,
        months: res.months,
        years: res.years,
        reachable: res.reachable,
        targetDate: res.reachable && isFinite(res.months) ? targetDate.toISOString().slice(0, 7) : 'Nedosažitelné',
      };
    });
  }

  static generateProjection(
    initialValue: number,
    monthlyDCA: number,
    annualNominalReturn: number,
    annualInflation: number = 0.025,
    years: number = 10
  ): ProjectionDataPoint[] {
    const points: ProjectionDataPoint[] = [];
    const totalMonths = years * 12;
    const j = annualNominalReturn / 12;
    const iMonth = annualInflation / 12;

    let currentValue = initialValue;
    let totalInvested = initialValue;

    // Month 0
    points.push({
      month: 0,
      year: 0,
      principalInvested: Math.round(initialValue),
      nominalValue: Math.round(initialValue),
      realValue: Math.round(initialValue),
      compoundInterestGain: 0,
    });

    for (let m = 1; m <= totalMonths; m++) {
      // Annuity due: invest at start of month, then apply monthly compounding
      currentValue = (currentValue + monthlyDCA) * (1 + j);
      totalInvested += monthlyDCA;

      const cumulativeInflation = Math.pow(1 + iMonth, m);
      const realValue = currentValue / cumulativeInflation;

      // Add points annually or semi-annually, plus final point
      if (m % 12 === 0 || m === totalMonths) {
        points.push({
          month: m,
          year: m / 12,
          principalInvested: Math.round(totalInvested),
          nominalValue: Math.round(currentValue),
          realValue: Math.round(realValue),
          compoundInterestGain: Math.round(currentValue - totalInvested),
        });
      }
    }

    return points;
  }

  static calculateFIRE(
    currentPortfolioValue: number,
    monthlyDCA: number,
    annualNominalReturn: number,
    desiredNetMonthlyExpense: number,
    isTaxExemptAccumulating: boolean = true,
    swrAnnualRate: number = 0.04
  ): FIREResult {
    const effectiveTaxRate = isTaxExemptAccumulating ? 0.0 : 0.15;
    const requiredGrossMonthly = desiredNetMonthlyExpense / (1 - effectiveTaxRate);
    
    // Required nest egg = (Annual Expenses) / SWR
    const firePortfolioTarget = (requiredGrossMonthly * 12) / swrAnnualRate;

    const milestone = this.monthsToMilestone(
      currentPortfolioValue,
      monthlyDCA,
      annualNominalReturn,
      firePortfolioTarget
    );

    const targetDate = new Date();
    if (milestone.reachable && isFinite(milestone.months)) {
      targetDate.setMonth(targetDate.getMonth() + milestone.months);
    }

    return {
      targetNetMonthlyExpense: desiredNetMonthlyExpense,
      effectiveTaxRate,
      firePortfolioTarget: Math.round(firePortfolioTarget),
      safeMonthlyGrossWithdrawal: Math.round(firePortfolioTarget * (swrAnnualRate / 12)),
      safeMonthlyNetIncome: Math.round(desiredNetMonthlyExpense),
      monthsToFIRE: milestone.months,
      yearsToFIRE: milestone.years,
      fireDate: milestone.reachable && isFinite(milestone.months) ? targetDate.toISOString().slice(0, 7) : 'Nedosažitelné',
    };
  }
}
