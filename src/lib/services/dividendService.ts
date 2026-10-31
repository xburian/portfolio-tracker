import { DividendTransaction, MonthlyDividendAggregate, HoldingDividendSummary, AnnualDividendAggregate, DividendPeriod } from '@/types/dividend';
import { CurrencyCode, Holding, PositionLot } from '@/types/portfolio';

export class DividendService {
  /**
   * Extracts distinct years present in the dividends, sorted descending (e.g. ['2026', '2025', '2024']).
   */
  static getAvailableYears(dividends: DividendTransaction[]): string[] {
    const years = new Set<string>();
    for (const d of dividends) {
      const y = d.yearMonth ? d.yearMonth.substring(0, 4) : d.paymentDateUtc?.substring(0, 4);
      if (y && /^\d{4}$/.test(y)) {
        years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }

  /**
   * Filters dividends by selected period: 'ALL', 'YTD', '1Y', '3Y', or specific calendar year (e.g. '2025').
   */
  static filterByPeriod(
    dividends: DividendTransaction[],
    period: DividendPeriod,
    now: Date = new Date()
  ): DividendTransaction[] {
    if (!period || period === 'ALL') {
      return dividends;
    }

    const currentYearStr = now.getFullYear().toString();

    if (period === 'YTD') {
      const startOfYear = `${currentYearStr}-01-01`;
      return dividends.filter(d => (d.paymentDateUtc || '') >= startOfYear);
    }

    if (period === '1Y') {
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      return dividends.filter(d => (d.paymentDateUtc || '') >= oneYearAgo);
    }

    if (period === '3Y') {
      const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      return dividends.filter(d => (d.paymentDateUtc || '') >= threeYearsAgo);
    }

    // Specific calendar year (e.g. "2025", "2024")
    if (/^\d{4}$/.test(period)) {
      return dividends.filter(d => {
        const y = d.yearMonth ? d.yearMonth.substring(0, 4) : d.paymentDateUtc?.substring(0, 4);
        return y === period;
      });
    }

    return dividends;
  }

  /**
   * Aggregates dividend transactions by calendar year with YoY growth and monthly average.
   * Sorted descending (newest year first).
   */
  static aggregateByYear(
    dividends: DividendTransaction[],
    now: Date = new Date()
  ): AnnualDividendAggregate[] {
    const currentYearStr = now.getFullYear().toString();
    const currentMonthNum = now.getMonth() + 1;

    const map = new Map<string, {
      totalNetCZK: number;
      totalGrossCZK: number;
      totalTaxCZK: number;
      count: number;
    }>();

    for (const d of dividends) {
      const y = d.yearMonth ? d.yearMonth.substring(0, 4) : d.paymentDateUtc?.substring(0, 4);
      if (!y || !/^\d{4}$/.test(y)) continue;

      let entry = map.get(y);
      if (!entry) {
        entry = {
          totalNetCZK: 0,
          totalGrossCZK: 0,
          totalTaxCZK: 0,
          count: 0,
        };
        map.set(y, entry);
      }

      entry.totalNetCZK += d.netAmountCZK;
      entry.totalGrossCZK += d.grossAmountCZK;
      entry.totalTaxCZK += d.withholdingTaxCZK;
      entry.count += 1;
    }

    const yearsSortedAsc = Array.from(map.keys()).sort();
    const results: AnnualDividendAggregate[] = [];

    for (let i = 0; i < yearsSortedAsc.length; i++) {
      const yr = yearsSortedAsc[i];
      const data = map.get(yr)!;
      const isYTD = yr === currentYearStr;

      const monthsDivisor = isYTD
        ? Math.max(1, currentMonthNum)
        : 12;

      const effectiveTaxRate = data.totalGrossCZK > 0
        ? (data.totalTaxCZK / data.totalGrossCZK) * 100
        : 0;

      let yoyGrowthPercent: number | undefined = undefined;
      if (i > 0) {
        const prevYear = yearsSortedAsc[i - 1];
        const prevData = map.get(prevYear)!;
        if (prevData.totalNetCZK > 0) {
          yoyGrowthPercent = Math.round(((data.totalNetCZK - prevData.totalNetCZK) / prevData.totalNetCZK) * 1000) / 10;
        }
      }

      results.push({
        year: yr,
        isYTD,
        totalNetCZK: Math.round(data.totalNetCZK * 100) / 100,
        totalGrossCZK: Math.round(data.totalGrossCZK * 100) / 100,
        totalTaxCZK: Math.round(data.totalTaxCZK * 100) / 100,
        effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
        transactionsCount: data.count,
        monthlyAverageCZK: Math.round((data.totalNetCZK / monthsDivisor) * 100) / 100,
        yoyGrowthPercent,
      });
    }

    return results.sort((a, b) => b.year.localeCompare(a.year));
  }

  /**
   * Aggregates dividend transactions by month (YYYY-MM) in chronological order.
   */
  static aggregateByMonth(dividends: DividendTransaction[]): MonthlyDividendAggregate[] {
    const map = new Map<string, {
      totalNetCZK: number;
      totalGrossCZK: number;
      totalTaxCZK: number;
      byCurrency: Record<CurrencyCode, number>;
      count: number;
    }>();

    for (const d of dividends) {
      const ym = d.yearMonth || d.paymentDateUtc.substring(0, 7);
      let agg = map.get(ym);
      if (!agg) {
        agg = {
          totalNetCZK: 0,
          totalGrossCZK: 0,
          totalTaxCZK: 0,
          byCurrency: { CZK: 0, EUR: 0, USD: 0, GBP: 0 },
          count: 0,
        };
        map.set(ym, agg);
      }

      agg.totalNetCZK += d.netAmountCZK;
      agg.totalGrossCZK += d.grossAmountCZK;
      agg.totalTaxCZK += d.withholdingTaxCZK;
      agg.byCurrency[d.currency] = (agg.byCurrency[d.currency] || 0) + d.netAmount;
      agg.count += 1;
    }

    return Array.from(map.entries())
      .map(([yearMonth, data]) => ({
        yearMonth,
        totalNetCZK: Math.round(data.totalNetCZK * 100) / 100,
        totalGrossCZK: Math.round(data.totalGrossCZK * 100) / 100,
        totalTaxCZK: Math.round(data.totalTaxCZK * 100) / 100,
        byCurrency: data.byCurrency,
        transactionsCount: data.count,
      }))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }

  /**
   * Aggregates dividends per stock holding and calculates Yield on Cost (YoC).
   */
  static aggregateByHolding(
    dividends: DividendTransaction[],
    holdings: Holding[] = [],
    lots: PositionLot[] = []
  ): HoldingDividendSummary[] {
    const map = new Map<string, {
      normalizedTicker: string;
      name: string;
      totalNetCZK: number;
      totalGrossCZK: number;
      totalTaxCZK: number;
      lastPaymentDate?: string;
    }>();

    for (const d of dividends) {
      const ticker = d.normalizedTicker;
      let agg = map.get(ticker);
      if (!agg) {
        const matchedHolding = holdings.find(h => h.normalizedTicker === ticker || h.rawTicker === d.rawTicker);
        agg = {
          normalizedTicker: ticker,
          name: matchedHolding?.name || d.rawTicker || ticker,
          totalNetCZK: 0,
          totalGrossCZK: 0,
          totalTaxCZK: 0,
          lastPaymentDate: d.paymentDateUtc,
        };
        map.set(ticker, agg);
      }

      agg.totalNetCZK += d.netAmountCZK;
      agg.totalGrossCZK += d.grossAmountCZK;
      agg.totalTaxCZK += d.withholdingTaxCZK;
      if (!agg.lastPaymentDate || d.paymentDateUtc > agg.lastPaymentDate) {
        agg.lastPaymentDate = d.paymentDateUtc;
      }
    }

    return Array.from(map.values())
      .map(entry => {
        // Calculate cost basis in CZK for this ticker from lots
        const relevantLots = lots.filter(l => {
          const lotTicker = l.holdingId?.split(':')?.[1] || '';
          return lotTicker === entry.normalizedTicker;
        });

        const totalCostNative = relevantLots.reduce((acc, l) => acc + (l.quantity * l.openPrice), 0);
        const effectiveTaxRate = entry.totalGrossCZK > 0
          ? (entry.totalTaxCZK / entry.totalGrossCZK) * 100
          : 0;

        // YoC estimation (simple annualized or total return on capital)
        const yieldOnCost = totalCostNative > 0
          ? (entry.totalNetCZK / totalCostNative) * 100
          : 0;

        return {
          normalizedTicker: entry.normalizedTicker,
          name: entry.name,
          totalNetCZK: Math.round(entry.totalNetCZK * 100) / 100,
          totalGrossCZK: Math.round(entry.totalGrossCZK * 100) / 100,
          totalTaxCZK: Math.round(entry.totalTaxCZK * 100) / 100,
          effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
          yieldOnCost: Math.round(yieldOnCost * 100) / 100,
          lastPaymentDate: entry.lastPaymentDate,
        };
      })
      .sort((a, b) => b.totalNetCZK - a.totalNetCZK);
  }

  /**
   * Overall summary across all dividends.
   */
  static calculateOverallSummary(dividends: DividendTransaction[]): {
    totalNetCZK: number;
    totalGrossCZK: number;
    totalTaxCZK: number;
    avgMonthlyNetCZK: number;
    effectiveTaxRate: number;
    count: number;
  } {
    if (dividends.length === 0) {
      return { totalNetCZK: 0, totalGrossCZK: 0, totalTaxCZK: 0, avgMonthlyNetCZK: 0, effectiveTaxRate: 0, count: 0 };
    }

    const totalNetCZK = dividends.reduce((sum, d) => sum + d.netAmountCZK, 0);
    const totalGrossCZK = dividends.reduce((sum, d) => sum + d.grossAmountCZK, 0);
    const totalTaxCZK = dividends.reduce((sum, d) => sum + d.withholdingTaxCZK, 0);

    const monthsSet = new Set(dividends.map(d => d.yearMonth || d.paymentDateUtc.substring(0, 7)));
    const activeMonthsCount = Math.max(1, monthsSet.size);
    const avgMonthlyNetCZK = totalNetCZK / activeMonthsCount;
    const effectiveTaxRate = totalGrossCZK > 0 ? (totalTaxCZK / totalGrossCZK) * 100 : 0;

    return {
      totalNetCZK: Math.round(totalNetCZK * 100) / 100,
      totalGrossCZK: Math.round(totalGrossCZK * 100) / 100,
      totalTaxCZK: Math.round(totalTaxCZK * 100) / 100,
      avgMonthlyNetCZK: Math.round(avgMonthlyNetCZK * 100) / 100,
      effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
      count: dividends.length,
    };
  }
}
