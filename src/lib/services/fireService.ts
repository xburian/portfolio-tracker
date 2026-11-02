import {
  CoastFIREResult,
  ComprehensiveFIREResult,
  CrossoverPointResult,
  DecumulationConfig,
  DecumulationPoint,
  FIRETierDetail,
  LiquidRunwayResult,
} from '@/types/budget';

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

  // Kumulovaný přeliv peněz ze spořícího účtu do akcií po dosažení stropu
  savingsSpilloverToStocks?: number;

  // Rozptyl / Koridor nejistoty (Confidence / Volatility Band)
  varianceUpperValue?: number;
  varianceLowerValue?: number;
  dispersionPercent?: number;
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
      maxSavingsBalanceCZK?: number; // e.g. 500_000 (Kč limit pro spořící účet)
      annualReturnDispersionPct?: number; // e.g. 5.0 (%) rozptyl ročního zhodnocení akcií (±5% p.a.)
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
    const maxSavingsCap = options.maxSavingsBalanceCZK;

    const dispersion = options.annualReturnDispersionPct !== undefined && options.annualReturnDispersionPct > 0
      ? options.annualReturnDispersionPct / 100
      : undefined;

    const jStockUpper = dispersion !== undefined ? (annualNominalReturn + dispersion) / 12 : jStock;
    const jStockLower = dispersion !== undefined ? Math.max(0, annualNominalReturn - dispersion) / 12 : jStock;

    let currentStocks = options.initialStocks !== undefined
      ? options.initialStocks
      : initialValue * stockAllocRatio;

    let currentSavings = options.initialSavings !== undefined
      ? options.initialSavings
      : initialValue * savingsAllocRatio;

    // If initial savings already exceeds cap, sweep initial excess to stocks
    if (maxSavingsCap !== undefined && maxSavingsCap > 0 && currentSavings > maxSavingsCap) {
      const initialExcess = currentSavings - maxSavingsCap;
      currentSavings = maxSavingsCap;
      currentStocks += initialExcess;
    }

    let currentStocksUpper = currentStocks;
    let currentStocksLower = currentStocks;

    let totalStocksInvested = currentStocks;
    let totalSavingsInvested = currentSavings;
    let cumulativeSpillover = 0;

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
      savingsSpilloverToStocks: 0,
      varianceUpperValue: dispersion !== undefined ? initialStocksRounded + initialSavingsRounded : undefined,
      varianceLowerValue: dispersion !== undefined ? initialStocksRounded + initialSavingsRounded : undefined,
      dispersionPercent: options.annualReturnDispersionPct,
    });

    for (let m = 1; m <= totalMonths; m++) {
      const stockDCA = monthlyDCA * stockAllocRatio;
      let savingsDCA = monthlyDCA * savingsAllocRatio;

      // 1. Savings interest accrual (with 15% CZ withholding tax)
      const savingsInterest = currentSavings * jSavings;
      currentSavings += savingsInterest;

      // 2. Emergency Cushion Cap check & Spillover
      let monthlySpillover = 0;
      if (maxSavingsCap !== undefined && maxSavingsCap > 0) {
        if (currentSavings > maxSavingsCap) {
          const excessInterest = currentSavings - maxSavingsCap;
          currentSavings = maxSavingsCap;
          monthlySpillover += excessInterest;
        }

        const roomRemaining = Math.max(0, maxSavingsCap - currentSavings);
        const actualSavingsDCA = Math.min(savingsDCA, roomRemaining);
        const excessContribution = savingsDCA - actualSavingsDCA;

        savingsDCA = actualSavingsDCA;
        monthlySpillover += excessContribution;
      }

      cumulativeSpillover += monthlySpillover;
      currentSavings += savingsDCA;
      totalSavingsInvested += savingsDCA;

      // 3. Stocks investment + spillover
      const totalStockDCA = stockDCA + monthlySpillover;
      currentStocks = (currentStocks + totalStockDCA) * (1 + jStock);
      if (dispersion !== undefined) {
        currentStocksUpper = (currentStocksUpper + totalStockDCA) * (1 + jStockUpper);
        currentStocksLower = (currentStocksLower + totalStockDCA) * (1 + jStockLower);
      }
      totalStocksInvested += totalStockDCA;

      const stocksRounded = Math.round(currentStocks);
      const savingsRounded = Math.round(currentSavings);
      const stocksInvestedRounded = Math.round(totalStocksInvested);
      const savingsInvestedRounded = Math.round(totalSavingsInvested);

      const currentValue = stocksRounded + savingsRounded;
      const totalInvested = stocksInvestedRounded + savingsInvestedRounded;

      const cumulativeInflation = Math.pow(1 + iMonth, m);
      const realValue = Math.round(currentValue / cumulativeInflation);

      // Dynamic sampling interval for smooth trajectory visualization
      const stepMonths = years <= 1 ? 1 : years <= 3 ? 2 : years <= 5 ? 3 : years <= 10 ? 6 : 12;
      if (m % stepMonths === 0 || m === totalMonths) {
        points.push({
          month: m,
          year: Math.round((m / 12) * 100) / 100,
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
          savingsSpilloverToStocks: Math.round(cumulativeSpillover),
          varianceUpperValue: dispersion !== undefined ? Math.round(currentStocksUpper + currentSavings) : undefined,
          varianceLowerValue: dispersion !== undefined ? Math.max(0, Math.round(currentStocksLower + currentSavings)) : undefined,
          dispersionPercent: options.annualReturnDispersionPct,
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

  /**
   * Calculates Coast FIRE capital requirements.
   * "How much do I need invested TODAY so that without adding another cent,
   * compound interest alone grows to my FIRE target by retirement age?"
   */
  static calculateCoastFIRE(
    currentCapital: number,
    fireTargetPortfolio: number,
    annualRealReturnPct: number = 5.0, // inflation-adjusted real return (e.g. 7-8% nominal - 2.5% inflation)
    currentAge: number = 32,
    targetRetirementAge: number = 60
  ): CoastFIREResult {
    const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);
    const rReal = annualRealReturnPct / 100;
    
    // Future value factor: (1 + rReal)^years
    const compoundMultiplier = Math.pow(1 + rReal, yearsToRetirement);
    const requiredCapitalToday = fireTargetPortfolio > 0 && compoundMultiplier > 0
      ? Math.round(fireTargetPortfolio / compoundMultiplier)
      : fireTargetPortfolio;

    const isCoasting = currentCapital >= requiredCapitalToday;
    const surplusOrShortfall = Math.round(currentCapital - requiredCapitalToday);

    return {
      currentAge,
      targetRetirementAge,
      yearsToRetirement,
      targetPortfolioAtRetirementCZK: Math.round(fireTargetPortfolio),
      requiredCapitalTodayCZK: requiredCapitalToday,
      currentInvestedCapitalCZK: Math.round(currentCapital),
      isCoastingAchieved: isCoasting,
      surplusOrShortfallCZK: surplusOrShortfall,
      expectedAnnualRealReturnPct: annualRealReturnPct,
    };
  }

  /**
   * Calculates liquid financial runway (emergency buffer) based on cash/savings and monthly expenses.
   */
  static calculateLiquidRunway(
    liquidCashAndSavingsCZK: number,
    essentialMonthlyExpensesCZK: number,
    totalMonthlyExpensesCZK: number
  ): LiquidRunwayResult {
    const essentialRunway = essentialMonthlyExpensesCZK > 0
      ? Math.round((liquidCashAndSavingsCZK / essentialMonthlyExpensesCZK) * 10) / 10
      : 999;

    const totalRunway = totalMonthlyExpensesCZK > 0
      ? Math.round((liquidCashAndSavingsCZK / totalMonthlyExpensesCZK) * 10) / 10
      : 999;

    let runwayStatus: 'critical' | 'healthy' | 'exceptional' = 'healthy';
    if (totalRunway < 3) {
      runwayStatus = 'critical';
    } else if (totalRunway >= 12) {
      runwayStatus = 'exceptional';
    }

    return {
      liquidCashAndSavingsCZK: Math.round(liquidCashAndSavingsCZK),
      essentialMonthlyExpensesCZK: Math.round(essentialMonthlyExpensesCZK),
      totalMonthlyExpensesCZK: Math.round(totalMonthlyExpensesCZK),
      essentialRunwayMonths: essentialRunway,
      totalRunwayMonths: totalRunway,
      runwayStatus,
    };
  }

  /**
   * Detects Crossover Point: The point in time when passive return from portfolio exceeds monthly expenses.
   */
  static calculateCrossoverPoint(
    projectionPoints: ProjectionDataPoint[],
    monthlyExpensesCZK: number,
    annualNominalReturn: number
  ): CrossoverPointResult {
    if (monthlyExpensesCZK <= 0 || projectionPoints.length === 0) {
      return { hasReached: false };
    }

    const monthlyReturnRate = annualNominalReturn / 12;
    const now = new Date();

    for (const pt of projectionPoints) {
      // Monthly passive growth in this month
      const passiveMonthlyGain = pt.stocksValue * monthlyReturnRate;
      if (passiveMonthlyGain >= monthlyExpensesCZK) {
        const targetDate = new Date(now);
        targetDate.setMonth(targetDate.getMonth() + pt.month);

        return {
          hasReached: true,
          crossoverMonth: pt.month,
          crossoverYear: pt.year,
          crossoverDate: targetDate.toISOString().slice(0, 7),
          portfolioValueAtCrossoverCZK: pt.nominalValue,
          monthlyPassiveGainCZK: Math.round(passiveMonthlyGain),
          monthlyExpensesCZK: Math.round(monthlyExpensesCZK),
        };
      }
    }

    return { hasReached: false };
  }

  /**
   * Calculates comprehensive multi-tier FIRE targets:
   * 1. Lean FIRE (Essential survival expenses)
   * 2. Standard FIRE (Current full lifestyle)
   * 3. Fat FIRE (+35% comfort/travel buffer)
   * 4. Barista FIRE (Expenses minus partial low-stress income)
   * 5. Coast FIRE (Capital needed today without additional contributions)
   * 6. Liquid Runway & Crossover point
   */
  static calculateComprehensiveFIRE(params: {
    currentPortfolioValue: number;
    monthlyDCA: number;
    annualNominalReturn: number; // e.g. 0.08
    swrAnnualRatePct: number;    // e.g. 3.5 (%)
    essentialMonthlyExpenses: number;
    totalMonthlyExpenses: number;
    baristaPartTimeIncome?: number; // e.g. 20_000 Kč
    fatBufferPct?: number;          // e.g. 35 (%)
    currentAge?: number;            // e.g. 32
    targetRetirementAge?: number;   // e.g. 60
    liquidCashAndSavings?: number;  // e.g. 300_000 Kč
    isTaxExemptAccumulating?: boolean;
    projectionPoints?: ProjectionDataPoint[];
  }): ComprehensiveFIREResult {
    const swrRatio = (params.swrAnnualRatePct || 4.0) / 100;
    const isTaxExempt = params.isTaxExemptAccumulating !== false;
    const effTaxRate = isTaxExempt ? 0.0 : 0.15;
    const baristaIncome = params.baristaPartTimeIncome ?? 20000;
    const fatBufferRatio = 1 + (params.fatBufferPct ?? 35) / 100;

    const buildTierDetail = (
      category: 'lean' | 'standard' | 'fat' | 'barista',
      name: string,
      description: string,
      monthlyExp: number
    ): FIRETierDetail => {
      const annualExp = monthlyExp * 12;
      const grossMonthly = monthlyExp / (1 - effTaxRate);
      const targetPortfolio = Math.round((grossMonthly * 12) / swrRatio);

      const milestone = this.monthsToMilestone(
        params.currentPortfolioValue,
        params.monthlyDCA,
        params.annualNominalReturn,
        targetPortfolio
      );

      const now = new Date();
      const fireDateObj = new Date(now);
      if (milestone.reachable && isFinite(milestone.months)) {
        fireDateObj.setMonth(fireDateObj.getMonth() + milestone.months);
      }

      const progress = targetPortfolio > 0
        ? Math.min(100, Math.round((params.currentPortfolioValue / targetPortfolio) * 1000) / 10)
        : 100;

      return {
        category,
        name,
        description,
        monthlyExpenseCZK: Math.round(monthlyExp),
        annualExpenseCZK: Math.round(annualExp),
        targetPortfolioCZK: targetPortfolio,
        monthsToFIRE: milestone.months,
        yearsToFIRE: milestone.years,
        fireDate: milestone.reachable && isFinite(milestone.months) ? fireDateObj.toISOString().slice(0, 7) : 'Nedosažitelné',
        reachable: milestone.reachable,
        progressPercentage: progress,
        monthlyPassiveIncomeCZK: Math.round(targetPortfolio * (swrRatio / 12)),
      };
    };

    const leanTier = buildTierDetail(
      'lean',
      'Lean FIRE',
      'Pokrytí pouze mandatorních výdajů na přežití (bydlení, jídlo, energie)',
      params.essentialMonthlyExpenses
    );

    const standardTier = buildTierDetail(
      'standard',
      'Standard FIRE',
      'Plné zachování stávajícího životního standardu včetně všech zbytných výdajů',
      params.totalMonthlyExpenses
    );

    const fatTier = buildTierDetail(
      'fat',
      'Fat FIRE',
      `Komfortní život s rezervou +${params.fatBufferPct ?? 35} % na cestování a koníčky`,
      Math.round(params.totalMonthlyExpenses * fatBufferRatio)
    );

    const baristaExpense = Math.max(0, params.totalMonthlyExpenses - baristaIncome);
    const baristaTier = buildTierDetail(
      'barista',
      'Barista FIRE',
      `Částečný úvazek / koníček generující ${baristaIncome.toLocaleString('cs-CZ')} Kč/měs, zbytek nese portfolio`,
      baristaExpense
    );

    const coastFIRE = this.calculateCoastFIRE(
      params.currentPortfolioValue,
      standardTier.targetPortfolioCZK,
      Math.max(1, (params.annualNominalReturn * 100) - 2.5), // real return
      params.currentAge ?? 32,
      params.targetRetirementAge ?? 60
    );

    const liquidRunway = this.calculateLiquidRunway(
      params.liquidCashAndSavings ?? 0,
      params.essentialMonthlyExpenses,
      params.totalMonthlyExpenses
    );

    const crossoverPoint = params.projectionPoints
      ? this.calculateCrossoverPoint(params.projectionPoints, params.totalMonthlyExpenses, params.annualNominalReturn)
      : { hasReached: false };

    return {
      currentPortfolioValueCZK: Math.round(params.currentPortfolioValue),
      monthlyDCA: Math.round(params.monthlyDCA),
      annualNominalReturnPct: Math.round(params.annualNominalReturn * 1000) / 10,
      swrAnnualRatePct: params.swrAnnualRatePct,
      isTaxExemptAccumulating: isTaxExempt,
      tiers: {
        lean: leanTier,
        standard: standardTier,
        fat: fatTier,
        barista: baristaTier,
      },
      coastFIRE,
      crossoverPoint,
      liquidRunway,
    };
  }

  /**
   * Simulates retirement drawdown (Decumulation phase) over 20-50 years with:
   * - Inflation indexation on monthly withdrawals
   * - 2-bucket drawdown (withdrawing from liquid cash cushion first when market drops)
   * - Sequence of Returns Risk (SORR) stress test option (e.g. -25% Y1, -15% Y2)
   */
  static simulateDecumulation(config: DecumulationConfig): DecumulationPoint[] {
    const points: DecumulationPoint[] = [];
    const totalMonths = config.horizonYears * 12;

    const rNormalMonth = Math.pow(1 + config.annualNominalReturnPct / 100, 1 / 12) - 1;
    const rCrashY1Month = Math.pow(1 - 0.25, 1 / 12) - 1; // -25% p.a.
    const rCrashY2Month = Math.pow(1 - 0.15, 1 / 12) - 1; // -15% p.a.
    const iMonth = Math.pow(1 + config.annualInflationPct / 100, 1 / 12) - 1;

    let currentPortfolio = config.initialPortfolioCZK;
    let currentCash = config.initialCashCushionCZK;
    let cumulativeWithdrawn = 0;
    let isBankrupt = false;

    // Month 0
    points.push({
      year: 0,
      month: 0,
      dateLabel: 'Začátek renty',
      portfolioValueCZK: Math.round(currentPortfolio),
      cashCushionCZK: Math.round(currentCash),
      totalWealthCZK: Math.round(currentPortfolio + currentCash),
      monthlyGrossWithdrawalCZK: Math.round(config.monthlyWithdrawalCZK),
      cumulativeWithdrawnCZK: 0,
      isBankrupt: false,
      realPurchasingPowerWealthCZK: Math.round(currentPortfolio + currentCash),
    });

    for (let m = 1; m <= totalMonths; m++) {
      if (isBankrupt) {
        if (m % 12 === 0 || m === totalMonths) {
          points.push({
            year: Math.floor(m / 12),
            month: m,
            dateLabel: `${Math.floor(m / 12)}. rok`,
            portfolioValueCZK: 0,
            cashCushionCZK: 0,
            totalWealthCZK: 0,
            monthlyGrossWithdrawalCZK: 0,
            cumulativeWithdrawnCZK: Math.round(cumulativeWithdrawn),
            isBankrupt: true,
            realPurchasingPowerWealthCZK: 0,
          });
        }
        continue;
      }

      // Inflation adjustment on monthly withdrawal
      const inflationMultiplier = Math.pow(1 + iMonth, m - 1);
      const currentMonthlyWithdrawal = config.monthlyWithdrawalCZK * inflationMultiplier;

      // Determine return rate in this month
      let rMonth = rNormalMonth;
      const isStressActive = config.stressTestEnabled && m <= 24;
      if (isStressActive) {
        rMonth = m <= 12 ? rCrashY1Month : rCrashY2Month;
      }

      // 1. Portfolio growth or drawdown
      currentPortfolio = currentPortfolio * (1 + rMonth);

      // 2. Withdrawal logic: 2-bucket defense
      // If market is suffering a stress crash and we have cash cushion, withdraw from cash first!
      let withdrawalRemaining = currentMonthlyWithdrawal;
      if (isStressActive && currentCash > 0) {
        const cashDrawn = Math.min(currentCash, withdrawalRemaining);
        currentCash -= cashDrawn;
        withdrawalRemaining -= cashDrawn;
      }

      // Withdraw remaining balance from portfolio
      if (withdrawalRemaining > 0) {
        if (currentPortfolio >= withdrawalRemaining) {
          currentPortfolio -= withdrawalRemaining;
        } else {
          // Empty portfolio and draw whatever is left from cash
          withdrawalRemaining -= currentPortfolio;
          currentPortfolio = 0;
          if (currentCash >= withdrawalRemaining) {
            currentCash -= withdrawalRemaining;
          } else {
            currentCash = 0;
            isBankrupt = true;
          }
        }
      }

      cumulativeWithdrawn += currentMonthlyWithdrawal;

      // Real wealth deflated by cumulative inflation
      const totalWealth = Math.max(0, currentPortfolio + currentCash);
      const realWealth = Math.round(totalWealth / Math.pow(1 + iMonth, m));

      // Record yearly points or final month
      if (m % 12 === 0 || m === totalMonths) {
        points.push({
          year: Math.floor(m / 12),
          month: m,
          dateLabel: `${Math.floor(m / 12)}. rok`,
          portfolioValueCZK: Math.round(currentPortfolio),
          cashCushionCZK: Math.round(currentCash),
          totalWealthCZK: Math.round(totalWealth),
          monthlyGrossWithdrawalCZK: Math.round(currentMonthlyWithdrawal),
          cumulativeWithdrawnCZK: Math.round(cumulativeWithdrawn),
          isBankrupt,
          realPurchasingPowerWealthCZK: realWealth,
        });
      }
    }

    return points;
  }
}
