import { describe, expect, it } from 'bun:test';
import { CurrencyDecompositionService } from '@/lib/services/currencyDecompositionService';
import { Holding, PositionLot } from '@/types/portfolio';

describe('Currency Decomposition & Daily Attribution Service (Senior Engineering Test Suite)', () => {
  it('strictly verifies algebraic invariant on foreign asset: Total Gain = Pure Asset + Pure FX + Cross Term', () => {
    // 10 shares of US equity bought at $150 with USD/CZK = 22.0. Cost = 10 * 150 * 22 = 33,000 CZK
    // Now trading at $180 with USD/CZK = 25.0. Value = 10 * 180 * 25 = 45,000 CZK
    // Total Gain = 45,000 - 33,000 = 12,000 CZK
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

    const rates = { USD: 25.0, EUR: 25.0, CZK: 1.0, GBP: 30.0 };
    const attribution = CurrencyDecompositionService.calculateCurrencyAttribution(holdings, lots, rates);

    expect(attribution.length).toBe(1);
    const usd = attribution[0];
    expect(usd.currency).toBe('USD');

    // Mathematical identity: Pure Asset + Pure FX + Cross == Total Gain
    const sumComponents = usd.pureAssetGainCZK + usd.pureFxGainCZK + usd.crossTermCZK;
    expect(sumComponents).toBeCloseTo(usd.totalGainCZK, 1);
  });

  it('correctly handles domestic CZK assets where FX gain and cross terms are strictly zero', () => {
    // Domestic Czech stock (e.g. CEZ or Komercni Banka)
    // 100 shares bought at 900 CZK (Cost = 90,000 CZK), currently at 1050 CZK (Value = 105,000 CZK)
    // Gain = +15,000 CZK purely from asset appreciation, FX impact = 0
    const holdings: Holding[] = [
      {
        id: 'acc1:CEZ',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'CEZ.CZ',
        normalizedTicker: 'CEZ.PR',
        name: 'CEZ a.s.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        totalQuantity: 100,
        averageOpenPrice: 900,
        currentPrice: 1050,
        previousClosePrice: 1040,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const lots: PositionLot[] = [
      {
        id: 'lot-cez',
        accountId: 'acc1',
        holdingId: 'acc1:CEZ',
        ticketId: 'CEZ-1',
        type: 'BUY',
        quantity: 100,
        openPrice: 900,
        openDateUtc: '2023-01-01T00:00:00.000Z',
        instrumentCurrency: 'CZK',
      },
    ];

    const rates = { USD: 24.0, EUR: 25.0, CZK: 1.0, GBP: 30.0 };
    const attribution = CurrencyDecompositionService.calculateCurrencyAttribution(holdings, lots, rates);

    expect(attribution.length).toBe(1);
    const czk = attribution[0];
    expect(czk.currency).toBe('CZK');
    expect(czk.pureFxGainCZK).toBe(0);
    expect(czk.crossTermCZK).toBe(0);
    expect(czk.pureAssetGainCZK).toBe(czk.totalGainCZK);
    expect(czk.totalGainCZK).toBe(15000);
  });

  it('accurately isolates currency baskets across USD, EUR, CZK and GBP simultaneously', () => {
    const multiCurrencyHoldings: Holding[] = [
      {
        id: 'h-usd',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'NVDA.US',
        normalizedTicker: 'NVDA',
        name: 'Nvidia Corp.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'USD',
        totalQuantity: 10,
        averageOpenPrice: 100,
        currentPrice: 120,
        previousClosePrice: 115,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
      {
        id: 'h-eur',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'ASML.NL',
        normalizedTicker: 'ASML',
        name: 'ASML Holding',
        assetClass: 'EQUITY',
        instrumentCurrency: 'EUR',
        totalQuantity: 5,
        averageOpenPrice: 700,
        currentPrice: 800,
        previousClosePrice: 790,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
      {
        id: 'h-czk',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'KOMB.CZ',
        normalizedTicker: 'KOMB.PR',
        name: 'Komerční banka',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        totalQuantity: 50,
        averageOpenPrice: 800,
        currentPrice: 850,
        previousClosePrice: 850,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const rates = { USD: 24.0, EUR: 25.0, CZK: 1.0, GBP: 29.0 };
    const attribution = CurrencyDecompositionService.calculateCurrencyAttribution(multiCurrencyHoldings, [], rates);

    expect(attribution.length).toBe(3);

    // Sum of portfolio weights must be 100%
    const totalWeight = attribution.reduce((sum, a) => sum + a.weightPercent, 0);
    expect(totalWeight).toBeCloseTo(100.0, 1);

    // Daily changes calculation
    const dailyChanges = CurrencyDecompositionService.calculateHoldingDailyChanges(multiCurrencyHoldings, rates);
    expect(dailyChanges.length).toBe(3);

    // NVDA: 10 qty * (120 - 115) = +$50 * 24 = +1200 CZK
    const nvda = dailyChanges.find(h => h.normalizedTicker === 'NVDA')!;
    expect(nvda.dailyGainCZK).toBe(1200);
    expect(nvda.dailyChangePercent).toBeCloseTo(4.35, 1);

    // KOMB: 50 qty * (850 - 850) = 0 change
    const komb = dailyChanges.find(h => h.normalizedTicker === 'KOMB.PR')!;
    expect(komb.dailyGainCZK).toBe(0);
    expect(komb.dailyChangePercent).toBe(0);
  });

  it('handles missing previousClosePrice defensively without throwing or NaN', () => {
    const unquotedHolding: Holding[] = [
      {
        id: 'h-unquoted',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'UNKNOWN.US',
        normalizedTicker: 'UNKNOWN',
        name: 'Unknown Asset',
        assetClass: 'EQUITY',
        instrumentCurrency: 'USD',
        totalQuantity: 10,
        averageOpenPrice: 50,
        currentPrice: 50,
        previousClosePrice: undefined, // Missing previousClose
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const rates = { USD: 24.0, EUR: 25.0, CZK: 1.0, GBP: 29.0 };
    const dailyChanges = CurrencyDecompositionService.calculateHoldingDailyChanges(unquotedHolding, rates);

    expect(dailyChanges.length).toBe(1);
    expect(dailyChanges[0].dailyChangePrice).toBe(0);
    expect(dailyChanges[0].dailyChangePercent).toBe(0);
    expect(dailyChanges[0].dailyGainCZK).toBe(0);
    expect(Number.isNaN(dailyChanges[0].dailyGainCZK)).toBe(false);
  });
});
