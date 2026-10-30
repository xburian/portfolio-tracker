import { describe, expect, it } from 'bun:test';
import { CurrencyDecompositionService } from '@/lib/services/currencyDecompositionService';
import { Holding, PositionLot } from '@/types/portfolio';

describe('Currency Decomposition & Daily Changes Service', () => {
  it('algebraic decomposition identity holds strictly: Total Gain = Pure Asset + Pure FX + Cross', () => {
    const holdings: Holding[] = [
      {
        id: 'acc1:AAPL',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'AAPL.US',
        normalizedTicker: 'AAPL',
        name: 'Apple Inc.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'USD',
        totalQuantity: 10,
        averageOpenPrice: 150,
        currentPrice: 180,
        previousClosePrice: 175,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const lots: PositionLot[] = [
      {
        id: 'lot1',
        accountId: 'acc1',
        holdingId: 'acc1:AAPL',
        ticketId: 'AAPL-1',
        type: 'BUY',
        quantity: 10,
        openPrice: 150,
        openDateUtc: '2023-01-01T00:00:00.000Z',
        instrumentCurrency: 'USD',
      },
    ];

    const rates = { USD: 24.0, EUR: 25.0, CZK: 1.0, GBP: 29.0 };
    const attribution = CurrencyDecompositionService.calculateCurrencyAttribution(holdings, lots, rates);

    expect(attribution.length).toBe(1);
    const usd = attribution[0];
    expect(usd.currency).toBe('USD');

    // Total Gain CZK: Q * P_t * FX_t - Q * P_open * FX_open
    // With FX_open = 24.0 and FX_t = 24.0 (as fallback), pure asset gain = 10 * 30 * 24 = 7200
    const sumComponents = usd.pureAssetGainCZK + usd.pureFxGainCZK + usd.crossTermCZK;
    expect(sumComponents).toBeCloseTo(usd.totalGainCZK, 1);
  });

  it('calculates daily change in CZK and percent correctly', () => {
    const holdings: Holding[] = [
      {
        id: 'acc1:NVDA',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'NVDA.US',
        normalizedTicker: 'NVDA',
        name: 'Nvidia Corp.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'USD',
        totalQuantity: 5,
        averageOpenPrice: 100,
        currentPrice: 120,
        previousClosePrice: 110, // yesterday was 110, today is 120 -> +10 (+9.09%)
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const rates = { USD: 24.0, EUR: 25.0, CZK: 1.0, GBP: 29.0 };
    const dailyChanges = CurrencyDecompositionService.calculateHoldingDailyChanges(holdings, rates);

    expect(dailyChanges.length).toBe(1);
    const nvda = dailyChanges[0];
    expect(nvda.dailyChangePrice).toBe(10);
    expect(nvda.dailyChangePercent).toBeCloseTo(9.09, 1);
    // 5 shares * $10 change * 24 CZK/USD = 1200 CZK
    expect(nvda.dailyGainCZK).toBe(1200);
  });
});
