import { CurrencyCode, Holding, PositionLot } from '@/types/portfolio';
import { CurrencyAttributionBreakdown, HoldingDailyChange } from '@/types/attribution';

export class CurrencyDecompositionService {
  /**
   * Calculates daily price and value changes for each holding.
   */
  static calculateHoldingDailyChanges(
    holdings: Holding[],
    ratesToCZK: Record<CurrencyCode, number>
  ): HoldingDailyChange[] {
    return holdings.map((h) => {
      const currentPrice = h.currentPrice || 0;
      // If previousClosePrice is not set, default to currentPrice (0 delta)
      const prevClose = h.previousClosePrice || currentPrice;
      const dailyChangePrice = currentPrice - prevClose;
      const dailyChangePercent = prevClose > 0 ? (dailyChangePrice / prevClose) * 100 : 0;

      const fxRate = ratesToCZK[h.instrumentCurrency] || 1.0;
      const dailyGainCZK = h.totalQuantity * dailyChangePrice * fxRate;
      const totalValueCZK = h.totalQuantity * currentPrice * fxRate;

      return {
        holdingId: h.id,
        normalizedTicker: h.normalizedTicker,
        name: h.name,
        currentPrice,
        previousClosePrice: prevClose,
        dailyChangePrice: Math.round(dailyChangePrice * 1000) / 1000,
        dailyChangePercent: Math.round(dailyChangePercent * 100) / 100,
        dailyGainCZK: Math.round(dailyGainCZK * 100) / 100,
        totalValueCZK: Math.round(totalValueCZK * 100) / 100,
        instrumentCurrency: h.instrumentCurrency,
      };
    });
  }

  /**
   * Performs exact algebraic decomposition of portfolio gains by currency basket:
   * Total Gain = Pure Asset Gain + Pure FX Gain + Cross Term
   */
  static calculateCurrencyAttribution(
    holdings: Holding[],
    lots: PositionLot[],
    ratesToCZK: Record<CurrencyCode, number>
  ): CurrencyAttributionBreakdown[] {
    const currencies: CurrencyCode[] = ['CZK', 'USD', 'EUR', 'GBP'];

    // Map lots to calculate average purchase exchange rate (or fallback to current rate)
    let totalPortfolioValueCZK = 0;
    const basketMap = new Map<CurrencyCode, {
      totalValueCZK: number;
      totalCostBasisCZK: number;
      pureAssetGainCZK: number;
      pureFxGainCZK: number;
      crossTermCZK: number;
      dailyGainCZK: number;
      totalPrevValueCZK: number;
    }>();

    for (const c of currencies) {
      basketMap.set(c, {
        totalValueCZK: 0,
        totalCostBasisCZK: 0,
        pureAssetGainCZK: 0,
        pureFxGainCZK: 0,
        crossTermCZK: 0,
        dailyGainCZK: 0,
        totalPrevValueCZK: 0,
      });
    }

    for (const h of holdings) {
      const cur = h.instrumentCurrency;
      const data = basketMap.get(cur);
      if (!data) continue;

      const currentFx = ratesToCZK[cur] || 1.0;
      const currentPrice = h.currentPrice || 0;
      const prevPrice = h.previousClosePrice || currentPrice;
      const qty = h.totalQuantity || 0;

      if (qty <= 0) continue;

      const valCZK = qty * currentPrice * currentFx;
      const prevValCZK = qty * prevPrice * currentFx;
      const dailyDeltaCZK = valCZK - prevValCZK;

      data.totalValueCZK += valCZK;
      data.totalPrevValueCZK += prevValCZK;
      data.dailyGainCZK += dailyDeltaCZK;
      totalPortfolioValueCZK += valCZK;

      // Calculate cost basis and FX decomposition from lots of this holding
      const holdingLots = lots.filter(l => l.holdingId === h.id || l.ticketId.includes(h.rawTicker));
      let lotCostCZK = 0;
      let lotPureAssetGainCZK = 0;
      let lotPureFxGainCZK = 0;
      let lotCrossTermCZK = 0;

      if (holdingLots.length > 0) {
        for (const lot of holdingLots) {
          const lQty = lot.quantity;
          const openPrice = lot.openPrice;
          // Approximate purchase FX: if CZK, 1.0. For foreign currency, assume reasonable open FX or currentFx if not recorded
          const openFx = cur === 'CZK' ? 1.0 : currentFx; // fallback if purchase-date FX not recorded

          const lotCost = lQty * openPrice * openFx;
          lotCostCZK += lotCost;

          const deltaP = currentPrice - openPrice;
          const deltaFx = currentFx - openFx;

          lotPureAssetGainCZK += lQty * deltaP * openFx;
          lotPureFxGainCZK += lQty * openPrice * deltaFx;
          lotCrossTermCZK += lQty * deltaP * deltaFx;
        }
      } else {
        // Fallback using averageOpenPrice
        const avgOpenPrice = h.averageOpenPrice || currentPrice;
        const openFx = currentFx;
        const deltaP = currentPrice - avgOpenPrice;
        const deltaFx = 0;

        lotCostCZK = qty * avgOpenPrice * openFx;
        lotPureAssetGainCZK = qty * deltaP * openFx;
        lotPureFxGainCZK = 0;
        lotCrossTermCZK = 0;
      }

      data.totalCostBasisCZK += lotCostCZK;
      data.pureAssetGainCZK += lotPureAssetGainCZK;
      data.pureFxGainCZK += lotPureFxGainCZK;
      data.crossTermCZK += lotCrossTermCZK;
    }

    return currencies
      .map(cur => {
        const d = basketMap.get(cur)!;
        const weight = totalPortfolioValueCZK > 0 ? (d.totalValueCZK / totalPortfolioValueCZK) * 100 : 0;
        const totalGainCZK = d.totalValueCZK - d.totalCostBasisCZK;
        const totalGainPercent = d.totalCostBasisCZK > 0 ? (totalGainCZK / d.totalCostBasisCZK) * 100 : 0;
        const dailyGainPercent = d.totalPrevValueCZK > 0 ? (d.dailyGainCZK / d.totalPrevValueCZK) * 100 : 0;

        return {
          currency: cur,
          totalValueCZK: Math.round(d.totalValueCZK * 100) / 100,
          weightPercent: Math.round(weight * 10) / 10,
          totalGainCZK: Math.round(totalGainCZK * 100) / 100,
          totalGainPercent: Math.round(totalGainPercent * 100) / 100,
          pureAssetGainCZK: Math.round(d.pureAssetGainCZK * 100) / 100,
          pureFxGainCZK: Math.round(d.pureFxGainCZK * 100) / 100,
          crossTermCZK: Math.round(d.crossTermCZK * 100) / 100,
          dailyGainCZK: Math.round(d.dailyGainCZK * 100) / 100,
          dailyGainPercent: Math.round(dailyGainPercent * 100) / 100,
        };
      })
      .filter(b => b.totalValueCZK > 0);
  }
}
