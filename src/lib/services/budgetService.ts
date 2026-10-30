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
    const rMonth = Math.pow(1 + config.expectedStockReturnPercent / 100, 1 / 12) - 1;
    const salaryGrowthRate = config.expectedSalaryGrowthPercent / 100;
    const expenseInflationRate = config.expectedExpenseInflationPercent / 100;
    const divYieldMonthly = (config.dividendYieldPercent / 100) / 12;

    const baseSalary = salaryConfig.baseMonthlyNetSalaryCZK;
    const initialExpenses = expenses.reduce((sum, e) => sum + e.monthlyAmountCZK, 0);

    let currentPortfolioValue = config.initialNetWorthCZK;
    let cumulativeInvested = config.initialNetWorthCZK;
    let cumulativeDividends = 0;

    const points: MonthlyWealthProjectionPoint[] = [];

    // Point 0 (Starting position)
    points.push({
      month: 0,
      yearMonthLabel: 'Nyní',
      salaryCZK: Math.round(baseSalary),
      expensesCZK: Math.round(initialExpenses),
      investedSurplusCZK: 0,
      cumulativeInvestedCZK: Math.round(cumulativeInvested),
      portfolioValueCZK: Math.round(currentPortfolioValue),
      reinvestedDividendsCZK: 0,
      compoundGrowthCZK: 0,
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

      // Dividend calculation and DRIP
      const monthlyDividend = currentPortfolioValue * divYieldMonthly * 0.85; // 15% net tax
      const dripAddition = config.dripEnabled ? monthlyDividend : 0;
      cumulativeDividends += monthlyDividend;

      // Compounding portfolio growth
      const capitalGain = currentPortfolioValue * rMonth;
      currentPortfolioValue = currentPortfolioValue + capitalGain + monthlyContribution + dripAddition;
      cumulativeInvested += monthlyContribution;

      const compoundGrowth = Math.max(0, currentPortfolioValue - cumulativeInvested - (config.dripEnabled ? 0 : cumulativeDividends));

      const yearNum = Math.floor((m - 1) / 12) + 1;
      const monthInYear = ((m - 1) % 12) + 1;

      points.push({
        month: m,
        yearMonthLabel: `R${yearNum} M${monthInYear}`,
        salaryCZK: Math.round(monthlySalary),
        expensesCZK: Math.round(monthlyExpenses),
        investedSurplusCZK: Math.round(monthlyContribution),
        cumulativeInvestedCZK: Math.round(cumulativeInvested),
        portfolioValueCZK: Math.round(currentPortfolioValue),
        reinvestedDividendsCZK: Math.round(cumulativeDividends),
        compoundGrowthCZK: Math.round(compoundGrowth),
      });
    }

    return points;
  }
}
