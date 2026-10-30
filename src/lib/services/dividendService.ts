import { DividendTransaction, MonthlyDividendAggregate, HoldingDividendSummary } from '@/types/dividend';
import { CurrencyCode, Holding, PositionLot } from '@/types/portfolio';

export class DividendService {
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
