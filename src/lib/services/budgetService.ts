import { CashflowSnapshot, ExpenseCategory, MonthlyWealthProjectionPoint, SalaryConfig, WealthProjectionConfig } from '@/types/budget';

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
      const savingsContribution = monthlyContribution * savingsAllocRatio;

      // Dividend calculation and DRIP on stocks
      const monthlyDividend = currentStocks * divYieldMonthly * 0.85; // 15% net tax
      const dripAddition = config.dripEnabled ? monthlyDividend : 0;
      cumulativeDividends += monthlyDividend;

      // Compounding stock growth
      const stockGain = currentStocks * rStockMonth;
      currentStocks = currentStocks + stockGain + stockContribution + dripAddition;
      cumulativeStocksInvested += stockContribution;

      // Compounding savings account growth (lower interest)
      const savingsInterest = currentSavings * rSavingsMonth;
      currentSavings = currentSavings + savingsInterest + savingsContribution;
      cumulativeSavingsInvested += savingsContribution;

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
      });
    }

    return points;
  }
}
