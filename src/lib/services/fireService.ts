export interface ProjectionDataPoint {
  month: number;
  year: number;
  principalInvested: number;
  nominalValue: number;
  realValue: number;
  compoundInterestGain: number;

  // 2-bucket split: Investice (Akcie & ETF) vs. Spořící účet (Spořák)
  stocksValue: number;
  stocksPrincipalInvested: number;
  stocksCompoundGain: number;

  savingsValue: number;
  savingsPrincipalInvested: number;
  savingsInterestGain: number;
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
    years: number = 10,
    options: {
      stockAllocationPct?: number; // e.g. 70 (%)
      savingsNominalReturn?: number; // e.g. 0.04 (4% p.a.)
      initialStocks?: number;
      initialSavings?: number;
    } = {}
  ): ProjectionDataPoint[] {
    const points: ProjectionDataPoint[] = [];
    const totalMonths = years * 12;

    const stockAllocRatio = (options.stockAllocationPct !== undefined ? options.stockAllocationPct : 100) / 100;
    const savingsAllocRatio = 1 - stockAllocRatio;

    const jStock = annualNominalReturn / 12;
    // 15% withholding tax on savings interest in CZ
    const savingsGross = options.savingsNominalReturn !== undefined ? options.savingsNominalReturn : 0.04;
    const jSavings = (savingsGross * 0.85) / 12;

    const iMonth = annualInflation / 12;

    let currentStocks = options.initialStocks !== undefined
      ? options.initialStocks
      : initialValue * stockAllocRatio;

    let currentSavings = options.initialSavings !== undefined
      ? options.initialSavings
      : initialValue * savingsAllocRatio;

    let totalStocksInvested = currentStocks;
    let totalSavingsInvested = currentSavings;

    const initialStocksRounded = Math.round(currentStocks);
    const initialSavingsRounded = Math.round(currentSavings);

    // Month 0
    points.push({
      month: 0,
      year: 0,
      principalInvested: initialStocksRounded + initialSavingsRounded,
      nominalValue: initialStocksRounded + initialSavingsRounded,
      realValue: initialStocksRounded + initialSavingsRounded,
      compoundInterestGain: 0,
      stocksValue: initialStocksRounded,
      stocksPrincipalInvested: initialStocksRounded,
      stocksCompoundGain: 0,
      savingsValue: initialSavingsRounded,
      savingsPrincipalInvested: initialSavingsRounded,
      savingsInterestGain: 0,
    });

    for (let m = 1; m <= totalMonths; m++) {
      const stockDCA = monthlyDCA * stockAllocRatio;
      const savingsDCA = monthlyDCA * savingsAllocRatio;

      // Stocks: Annuity due (compounding monthly)
      currentStocks = (currentStocks + stockDCA) * (1 + jStock);
      totalStocksInvested += stockDCA;

      // Savings account: Lower interest rate (compounding monthly)
      currentSavings = (currentSavings + savingsDCA) * (1 + jSavings);
      totalSavingsInvested += savingsDCA;

      const stocksRounded = Math.round(currentStocks);
      const savingsRounded = Math.round(currentSavings);
      const stocksInvestedRounded = Math.round(totalStocksInvested);
      const savingsInvestedRounded = Math.round(totalSavingsInvested);

      const currentValue = stocksRounded + savingsRounded;
      const totalInvested = stocksInvestedRounded + savingsInvestedRounded;

      const cumulativeInflation = Math.pow(1 + iMonth, m);
      const realValue = Math.round(currentValue / cumulativeInflation);

      // Add points annually or semi-annually, plus final point
      if (m % 12 === 0 || m === totalMonths) {
        points.push({
          month: m,
          year: m / 12,
          principalInvested: totalInvested,
          nominalValue: currentValue,
          realValue,
          compoundInterestGain: Math.max(0, currentValue - totalInvested),
          stocksValue: stocksRounded,
          stocksPrincipalInvested: stocksInvestedRounded,
          stocksCompoundGain: Math.max(0, stocksRounded - stocksInvestedRounded),
          savingsValue: savingsRounded,
          savingsPrincipalInvested: savingsInvestedRounded,
          savingsInterestGain: Math.max(0, savingsRounded - savingsInvestedRounded),
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
