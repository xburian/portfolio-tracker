import { describe, it, expect } from 'vitest';
import { PerformanceService, PerformancePeriod } from '../src/lib/services/performanceService';
import { ValuationDetail, PositionLot, Holding } from '../src/types/portfolio';

describe('PerformanceService (Portfolio Performance Drill-Down)', () => {
  const dummyHoldingSp500: Holding = {
    id: 'acc1:SXR8.DE',
    accountId: 'acc1',
    brokerId: 'XTB',
    rawTicker: 'SXR8.DE',
    normalizedTicker: 'SXR8.DE',
    name: 'iShares Core S&P 500',
    assetClass: 'ETF',
    instrumentCurrency: 'EUR',
    totalQuantity: 10,
    averageOpenPrice: 400,
    currentPrice: 740,
    lastPriceUpdate: new Date().toISOString(),
    tags: ['S&P 500'],
  };

  const dummyHoldingBrk: Holding = {
    id: 'acc1:BRK-B',
    accountId: 'acc1',
    brokerId: 'XTB',
    rawTicker: 'BRK-B',
    normalizedTicker: 'BRK-B',
    name: 'Berkshire Hathaway B',
    assetClass: 'EQUITY',
    instrumentCurrency: 'USD',
    totalQuantity: 20,
    averageOpenPrice: 300,
    currentPrice: 540,
    lastPriceUpdate: new Date().toISOString(),
    tags: ['Value'],
  };

  const dummyValuations: ValuationDetail[] = [
    {
      holding: dummyHoldingSp500,
      quantity: 10,
      instrumentCurrency: 'EUR',
      currentPriceNative: 740,
      costBasisNative: 4000,
      marketValueNative: 7400,
      unrealizedProfitNative: 3400,
      unrealizedProfitPercent: 85.0,
      targetCurrency: 'CZK',
      exchangeRateNativeToTarget: 25.0,
      currentPriceTarget: 18500, // 740 * 25
      costBasisTarget: 100000,
      marketValueTarget: 185000,
      unrealizedProfitTarget: 85000,
      pureAssetGainTarget: 85000,
      fxGainTarget: 0,
      weightInPortfolio: 0.45,
    },
    {
      holding: dummyHoldingBrk,
      quantity: 20,
      instrumentCurrency: 'USD',
      currentPriceNative: 540,
      costBasisNative: 6000,
      marketValueNative: 10800,
      unrealizedProfitNative: 4800,
      unrealizedProfitPercent: 80.0,
      targetCurrency: 'CZK',
      exchangeRateNativeToTarget: 23.0,
      currentPriceTarget: 12420, // 540 * 23
      costBasisTarget: 138000,
      marketValueTarget: 248400,
      unrealizedProfitTarget: 110400,
      pureAssetGainTarget: 110400,
      fxGainTarget: 0,
      weightInPortfolio: 0.55,
    },
  ];

  // Lots spanning 2021 to 2026
  const dummyLots: PositionLot[] = [
    {
      id: 'lot-1',
      accountId: 'acc1',
      holdingId: 'acc1:SXR8.DE',
      ticketId: 't1',
      type: 'BUY',
      quantity: 5,
      openPrice: 400,
      openDateUtc: '2021-05-10T10:00:00Z', // 5Y ago
      instrumentCurrency: 'EUR',
    },
    {
      id: 'lot-2',
      accountId: 'acc1',
      holdingId: 'acc1:SXR8.DE',
      ticketId: 't2',
      type: 'BUY',
      quantity: 5,
      openPrice: 500,
      openDateUtc: '2026-03-15T10:00:00Z', // YTD 2026
      instrumentCurrency: 'EUR',
    },
    {
      id: 'lot-3',
      accountId: 'acc1',
      holdingId: 'acc1:BRK-B',
      ticketId: 't3',
      type: 'BUY',
      quantity: 10,
      openPrice: 280,
      openDateUtc: '2022-08-15T10:00:00Z', // 3Y+ ago
      instrumentCurrency: 'USD',
    },
    {
      id: 'lot-4',
      accountId: 'acc1',
      holdingId: 'acc1:BRK-B',
      ticketId: 't4',
      type: 'BUY',
      quantity: 10,
      openPrice: 480,
      openDateUtc: '2026-02-10T10:00:00Z', // YTD 2026
      instrumentCurrency: 'USD',
    },
  ];

  it('correctly determines period bounds for YTD, 1Y, 3Y and 5Y', () => {
    const ytd = PerformanceService.getPeriodBounds('YTD');
    expect(ytd.label).toContain('YTD');
    expect(ytd.startDate.getMonth()).toBe(0);
    expect(ytd.startDate.getDate()).toBe(1);

    const oneY = PerformanceService.getPeriodBounds('1Y');
    expect(oneY.label).toContain('1Y');

    const threeY = PerformanceService.getPeriodBounds('3Y');
    expect(threeY.label).toContain('3Y');

    const fiveY = PerformanceService.getPeriodBounds('5Y');
    expect(fiveY.label).toContain('5Y');
  });

  it('calculates YTD performance with new cash inflows weighted by time', () => {
    const res = PerformanceService.calculatePeriodPerformance(
      dummyValuations,
      dummyLots,
      'YTD',
      'CZK'
    );

    expect(res.period).toBe('YTD');
    expect(res.endValue).toBeGreaterThan(0);
    expect(res.newCapitalInvested).toBeGreaterThan(0); // Lot 2 and Lot 4 were bought in 2026
    expect(res.moneyWeightedReturnPercent).toBeGreaterThan(0);
    expect(res.benchmarkSp500ReturnPercent).toBe(18.4);
    expect(typeof res.alpha).toBe('number');
    expect(res.topWinners.length).toBeGreaterThan(0);
  });

  it('calculates 3Y performance and provides annualized CAGR p.a.', () => {
    const res = PerformanceService.calculatePeriodPerformance(
      dummyValuations,
      dummyLots,
      '3Y',
      'CZK'
    );

    expect(res.period).toBe('3Y');
    expect(res.durationYears).toBeCloseTo(3.0, 1);
    expect(res.annualizedReturnPercent).toBeDefined();
    expect(res.annualizedReturnPercent!).toBeGreaterThan(0);
    // CAGR should be lower than cumulative 3-year return
    expect(res.annualizedReturnPercent!).toBeLessThan(res.moneyWeightedReturnPercent);
  });

  it('calculates 5Y performance with accurate trajectory curve', () => {
    const res = PerformanceService.calculatePeriodPerformance(
      dummyValuations,
      dummyLots,
      '5Y',
      'CZK'
    );

    expect(res.period).toBe('5Y');
    expect(res.durationYears).toBeCloseTo(5.0, 1);
    expect(res.trajectory.length).toBeGreaterThanOrEqual(8);
    expect(res.trajectory[0].value).toBeLessThan(res.trajectory[res.trajectory.length - 1].value);
    expect(res.benchmarkSp500ReturnPercent).toBe(78.6);
  });

  it('correctly ranks top contributing holdings', () => {
    const res = PerformanceService.calculatePeriodPerformance(
      dummyValuations,
      dummyLots,
      '1Y',
      'CZK'
    );

    expect(res.topWinners).toBeDefined();
    expect(res.topWinners[0].profitTarget).toBeGreaterThanOrEqual(res.topWinners[res.topWinners.length - 1].profitTarget);
  });
});
