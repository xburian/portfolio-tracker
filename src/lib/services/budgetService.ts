import { CashflowSnapshot, ExpenseCategory, MonthlyWealthProjectionPoint, SalaryBonusConfig, SalaryConfig, SalaryProjectionYearPoint, WealthProjectionConfig } from '@/types/budget';

export class BudgetService {
  /**
   * Calculates current cashflow snapshot including net investable surplus and countdown to payday.
   */
  static calculateCashflowSnapshot(
    salaryConfig: SalaryConfig,
    expenses: ExpenseCategory[],
    currentDate: Date = new Date()
  ): CashflowSnapshot {
    const baseSalary = salaryConfig.baseMonthlyNetSalaryCZK || 0;

    // Calculate annualized bonuses divided by 12
    const totalAnnualBonuses = (salaryConfig.bonuses || []).reduce((sum, b) => {
      return sum + (b.isRecurringAnnual ? b.amountNetCZK : 0);
    }, 0);
    const monthlyBonuses = totalAnnualBonuses / 12;

    let essentialExpenses = 0;
    let discretionaryExpenses = 0;

    for (const exp of expenses) {
      if (exp.isEssential) {
        essentialExpenses += exp.monthlyAmountCZK;
      } else {
        discretionaryExpenses += exp.monthlyAmountCZK;
      }
    }

    const totalExpenses = essentialExpenses + discretionaryExpenses;
    const netInvestableCapacity = Math.max(0, baseSalary + monthlyBonuses - totalExpenses);
    const totalIncome = baseSalary + monthlyBonuses;
    const savingsRate = totalIncome > 0 ? (netInvestableCapacity / totalIncome) * 100 : 0;

    // Countdown to payday (e.g. 15th of month)
    const payday = salaryConfig.paydayDayOfMonth || 15;
    const currentDay = currentDate.getDate();
    let daysUntilPayday = 0;

    if (currentDay <= payday) {
      daysUntilPayday = payday - currentDay;
    } else {
      // Days remaining in current month + payday days in next month
      const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      daysUntilPayday = (daysInCurrentMonth - currentDay) + payday;
    }

    return {
      monthlyNetSalaryCZK: Math.round(baseSalary),
      monthlyBonusesCZK: Math.round(monthlyBonuses),
      totalMonthlyExpensesCZK: Math.round(totalExpenses),
      essentialExpensesCZK: Math.round(essentialExpenses),
      discretionaryExpensesCZK: Math.round(discretionaryExpenses),
      netInvestableCapacityCZK: Math.round(netInvestableCapacity),
      savingsRatePercentage: Math.round(savingsRate * 10) / 10,
      daysUntilPayday,
    };
  }

  /**
   * Discrete monthly compounding wealth projection engine:
   * Horizon: 1y (12m), 3y (36m), 5y (60m), 10y (120m).
   */
  static simulateWealthProjection(
    config: WealthProjectionConfig,
    salaryConfig: SalaryConfig,
    expenses: ExpenseCategory[]
  ): MonthlyWealthProjectionPoint[] {
    const totalMonths = config.horizonYears * 12;
    const stockAllocRatio = (config.stockAllocationPercent !== undefined ? config.stockAllocationPercent : 100) / 100;
    const savingsAllocRatio = 1 - stockAllocRatio;

    const rStockMonth = Math.pow(1 + config.expectedStockReturnPercent / 100, 1 / 12) - 1;
    const savingsAnnualReturn = config.expectedSavingsReturnPercent !== undefined ? config.expectedSavingsReturnPercent : 4.0;
    // 15% withholding tax on savings interest in Czech Republic
    const rSavingsMonth = (Math.pow(1 + savingsAnnualReturn / 100, 1 / 12) - 1) * 0.85;

    const salaryGrowthRate = config.expectedSalaryGrowthPercent / 100;
    const expenseInflationRate = config.expectedExpenseInflationPercent / 100;
    const divYieldMonthly = (config.dividendYieldPercent / 100) / 12;

    const baseSalary = salaryConfig.baseMonthlyNetSalaryCZK;
    const initialExpenses = expenses.reduce((sum, e) => sum + e.monthlyAmountCZK, 0);

    let currentStocks = config.initialStocksCZK !== undefined
      ? config.initialStocksCZK
      : config.initialNetWorthCZK * stockAllocRatio;

    let currentSavings = config.initialSavingsCZK !== undefined
      ? config.initialSavingsCZK
      : config.initialNetWorthCZK * savingsAllocRatio;

    // If initial savings already exceeds target cap, sweep initial excess into stocks
    if (config.maxSavingsBalanceCZK !== undefined && config.maxSavingsBalanceCZK > 0 && currentSavings > config.maxSavingsBalanceCZK) {
      const initialExcess = currentSavings - config.maxSavingsBalanceCZK;
      currentSavings = config.maxSavingsBalanceCZK;
      currentStocks += initialExcess;
    }

    const dispersion = config.annualReturnDispersionPercent !== undefined && config.annualReturnDispersionPercent > 0
      ? config.annualReturnDispersionPercent / 100
      : undefined;

    const rStockMonthUpper = dispersion !== undefined
      ? Math.pow(1 + (config.expectedStockReturnPercent / 100 + dispersion), 1 / 12) - 1
      : rStockMonth;

    const rStockMonthLower = dispersion !== undefined
      ? Math.pow(1 + Math.max(0, config.expectedStockReturnPercent / 100 - dispersion), 1 / 12) - 1
      : rStockMonth;

    let currentStocksUpper = currentStocks;
    let currentStocksLower = currentStocks;

    let cumulativeStocksInvested = currentStocks;
    let cumulativeSavingsInvested = currentSavings;
    let cumulativeDividends = 0;

    const points: MonthlyWealthProjectionPoint[] = [];

    const initialStocksRounded = Math.round(currentStocks);
    const initialSavingsRounded = Math.round(currentSavings);
    const initialStocksInvested = Math.round(cumulativeStocksInvested);
    const initialSavingsInvested = Math.round(cumulativeSavingsInvested);

    // Point 0 (Starting position)
    points.push({
      month: 0,
      yearMonthLabel: 'Nyní',
      salaryCZK: Math.round(baseSalary),
      expensesCZK: Math.round(initialExpenses),
      investedSurplusCZK: 0,
      cumulativeInvestedCZK: initialStocksInvested + initialSavingsInvested,
      portfolioValueCZK: initialStocksRounded + initialSavingsRounded,
      reinvestedDividendsCZK: 0,
      compoundGrowthCZK: 0,
      stocksValueCZK: initialStocksRounded,
      stocksInvestedCZK: initialStocksInvested,
      stocksCompoundGainCZK: 0,
      savingsValueCZK: initialSavingsRounded,
      savingsInvestedCZK: initialSavingsInvested,
      savingsInterestCZK: 0,
      varianceUpperValueCZK: dispersion !== undefined ? initialStocksRounded + initialSavingsRounded : undefined,
      varianceLowerValueCZK: dispersion !== undefined ? initialStocksRounded + initialSavingsRounded : undefined,
    });

    for (let m = 1; m <= totalMonths; m++) {
      // Career escalator: salary increases every 12 months
      const completedYears = Math.floor((m - 1) / 12);
      const monthlySalary = baseSalary * Math.pow(1 + salaryGrowthRate, completedYears);

      // Check for bonuses in this month (1-12)
      const calendarMonth = ((m - 1) % 12) + 1;
      const monthBonus = (salaryConfig.bonuses || [])
        .filter(b => b.month === calendarMonth)
        .reduce((sum, b) => sum + b.amountNetCZK, 0);

      // Expense inflation: continuous yearly compounding
      const monthlyExpenses = initialExpenses * Math.pow(1 + expenseInflationRate, (m - 1) / 12);

      // Monthly surplus available for investment
      const availableSurplus = Math.max(0, monthlySalary + monthBonus - monthlyExpenses);
      const monthlyContribution = availableSurplus * (config.savingsReinvestmentRatePercent / 100);

      const stockContribution = monthlyContribution * stockAllocRatio;
      let savingsContribution = monthlyContribution * savingsAllocRatio;

      // Dividend calculation and DRIP on stocks
      const monthlyDividend = currentStocks * divYieldMonthly * 0.85; // 15% net tax
      const dripAddition = config.dripEnabled ? monthlyDividend : 0;
      cumulativeDividends += monthlyDividend;

      // Savings account interest (with 15% CZ withholding tax)
      const savingsInterest = currentSavings * rSavingsMonth;
      currentSavings += savingsInterest;

      // Emergency Cushion Cap check & Spillover to stocks
      let monthlySpillover = 0;
      const maxCap = config.maxSavingsBalanceCZK;
      if (maxCap !== undefined && maxCap > 0) {
        if (currentSavings > maxCap) {
          const excessInterest = currentSavings - maxCap;
          currentSavings = maxCap;
          monthlySpillover += excessInterest;
        }

        const roomRemaining = Math.max(0, maxCap - currentSavings);
        const actualSavingsContrib = Math.min(savingsContribution, roomRemaining);
        const excessContribution = savingsContribution - actualSavingsContrib;

        savingsContribution = actualSavingsContrib;
        monthlySpillover += excessContribution;
      }

      currentSavings += savingsContribution;
      cumulativeSavingsInvested += savingsContribution;

      // Compounding stock growth + regular contribution + spillover from savings cap + DRIP
      const stockGain = currentStocks * rStockMonth;
      const totalStockContribution = stockContribution + monthlySpillover;
      currentStocks = currentStocks + stockGain + totalStockContribution + dripAddition;

      if (dispersion !== undefined) {
        const stockGainUpper = currentStocksUpper * rStockMonthUpper;
        const stockGainLower = currentStocksLower * rStockMonthLower;
        const monthlyDivUpper = currentStocksUpper * divYieldMonthly * 0.85;
        const monthlyDivLower = currentStocksLower * divYieldMonthly * 0.85;
        const dripUpper = config.dripEnabled ? monthlyDivUpper : 0;
        const dripLower = config.dripEnabled ? monthlyDivLower : 0;
        currentStocksUpper = currentStocksUpper + stockGainUpper + totalStockContribution + dripUpper;
        currentStocksLower = currentStocksLower + stockGainLower + totalStockContribution + dripLower;
      }

      cumulativeStocksInvested += totalStockContribution;

      const stocksRounded = Math.round(currentStocks);
      const savingsRounded = Math.round(currentSavings);
      const stocksInvestedRounded = Math.round(cumulativeStocksInvested);
      const savingsInvestedRounded = Math.round(cumulativeSavingsInvested);

      const totalPortfolioValue = stocksRounded + savingsRounded;
      const totalCumulativeInvested = stocksInvestedRounded + savingsInvestedRounded;
      const totalCompoundGrowth = Math.max(0, totalPortfolioValue - totalCumulativeInvested);

      const yearNum = Math.floor((m - 1) / 12) + 1;
      const monthInYear = ((m - 1) % 12) + 1;

      points.push({
        month: m,
        yearMonthLabel: `R${yearNum} M${monthInYear}`,
        salaryCZK: Math.round(monthlySalary),
        expensesCZK: Math.round(monthlyExpenses),
        investedSurplusCZK: Math.round(monthlyContribution),
        cumulativeInvestedCZK: totalCumulativeInvested,
        portfolioValueCZK: totalPortfolioValue,
        reinvestedDividendsCZK: Math.round(cumulativeDividends),
        compoundGrowthCZK: totalCompoundGrowth,
        stocksValueCZK: stocksRounded,
        stocksInvestedCZK: stocksInvestedRounded,
        stocksCompoundGainCZK: Math.max(0, stocksRounded - stocksInvestedRounded),
        savingsValueCZK: savingsRounded,
        savingsInvestedCZK: savingsInvestedRounded,
        savingsInterestCZK: Math.max(0, savingsRounded - savingsInvestedRounded),
        varianceUpperValueCZK: dispersion !== undefined ? Math.round(currentStocksUpper + currentSavings) : undefined,
        varianceLowerValueCZK: dispersion !== undefined ? Math.max(0, Math.round(currentStocksLower + currentSavings)) : undefined,
      });
    }

    return points;
  }

  /**
   * Generates year-by-year trajectory of net salary evolution based on annual career escalation percentage.
   */
  static generateSalaryProgression(
    baseMonthlyNetSalaryCZK: number,
    annualIncreasePercentage: number,
    horizonYears: number = 5,
    bonuses: SalaryBonusConfig[] = [],
    annualInflationPercentage: number = 2.5
  ): SalaryProjectionYearPoint[] {
    const points: SalaryProjectionYearPoint[] = [];
    const growthRate = (annualIncreasePercentage || 0) / 100;
    const inflationRate = (annualInflationPercentage || 0) / 100;

    const baseBonuses = (bonuses || []).reduce((sum, b) => sum + (b.amountNetCZK || 0), 0);

    let cumulativeEarned = 0;

    for (let yr = 0; yr <= horizonYears; yr++) {
      // Escalator: salary compounds annually
      const growthFactor = Math.pow(1 + growthRate, yr);
      const monthlyNet = Math.round(baseMonthlyNetSalaryCZK * growthFactor);
      const monthlyIncrease = monthlyNet - baseMonthlyNetSalaryCZK;
      const pctIncrease = baseMonthlyNetSalaryCZK > 0
        ? Math.round(((monthlyNet - baseMonthlyNetSalaryCZK) / baseMonthlyNetSalaryCZK) * 1000) / 10
        : 0;

      const annualSalary = monthlyNet * 12;
      const annualBonuses = Math.round(baseBonuses * growthFactor);
      const totalAnnualIncome = annualSalary + annualBonuses;

      cumulativeEarned += totalAnnualIncome;

      // Inflation deflation for purchasing power
      const inflationFactor = Math.pow(1 + inflationRate, yr);
      const realMonthly = Math.round(monthlyNet / inflationFactor);

      points.push({
        year: yr,
        yearLabel: yr === 0 ? 'Nyní' : `${yr}. rok`,
        monthlyNetSalaryCZK: monthlyNet,
        monthlyNetIncreaseCZK: monthlyIncrease,
        percentageIncrease: pctIncrease,
        annualNetSalaryCZK: annualSalary,
        annualBonusesCZK: annualBonuses,
        totalAnnualNetIncomeCZK: totalAnnualIncome,
        cumulativeNetEarnedCZK: cumulativeEarned,
        realPurchasingPowerMonthlyCZK: realMonthly,
      });
    }

    return points;
  }
}
