import { describe, it, expect } from 'vitest';
import { TaxTimeTestService } from '@/lib/services/taxTimeTestService';
import { PositionLot, ValuationDetail } from '@/types/portfolio';

describe('TaxTimeTestService (Czech 3-Year Time Test § 4 ZDP)', () => {
  it('correctly identifies lots older than 3 years as tax-exempt', () => {
    const buyDate = '2021-05-10T10:00:00Z';
    const refDate = new Date('2026-10-26T00:00:00Z');
    expect(TaxTimeTestService.isLotExempt(buyDate, refDate)).toBe(true);
  });

  it('correctly identifies lots younger than 3 years as locked', () => {
    const buyDate = '2025-01-15T10:00:00Z';
    const refDate = new Date('2026-10-26T00:00:00Z');
    expect(TaxTimeTestService.isLotExempt(buyDate, refDate)).toBe(false);
  });

  it('calculates exempt vs locked quantities and estimated 15% tax saved', () => {
    const refDate = new Date('2026-10-26T00:00:00Z');

    const valuation: ValuationDetail = {
      holding: {
        id: 'acc1:SXR8.DE',
        accountId: 'acc1',
        brokerId: 'XTB',
        rawTicker: 'SXR8.DE',
        normalizedTicker: 'SXR8.DE',
        name: 'iShares Core S&P 500',
        assetClass: 'ETF',
        instrumentCurrency: 'EUR',
        totalQuantity: 20,
        averageOpenPrice: 400,
        currentPrice: 600,
        lastPriceUpdate: refDate.toISOString(),
        tags: ['S&P 500'],
      },
      quantity: 20,
      instrumentCurrency: 'EUR',
      currentPriceNative: 600,
      costBasisNative: 8000,
      marketValueNative: 12000,
      unrealizedProfitNative: 4000,
      unrealizedProfitPercent: 50,
      targetCurrency: 'CZK',
      exchangeRateNativeToTarget: 25.0,
      currentPriceTarget: 15000,
      costBasisTarget: 200000,
      marketValueTarget: 300000,
      unrealizedProfitTarget: 100000,
      pureAssetGainTarget: 100000,
      fxGainTarget: 0,
      weightInPortfolio: 1,
    };

    const lots: PositionLot[] = [
      // Lot 1: Bought 4 years ago (10 pcs @ 350 EUR) -> EXEMPT
      {
        id: 'lot-1',
        accountId: 'acc1',
        holdingId: 'acc1:SXR8.DE',
        ticketId: 't1',
        type: 'BUY',
        quantity: 10,
        openPrice: 350,
        openDateUtc: '2022-03-01T10:00:00Z',
        instrumentCurrency: 'EUR',
      },
      // Lot 2: Bought 1 year ago (10 pcs @ 450 EUR) -> LOCKED
      {
        id: 'lot-2',
        accountId: 'acc1',
        holdingId: 'acc1:SXR8.DE',
        ticketId: 't2',
        type: 'BUY',
        quantity: 10,
        openPrice: 450,
        openDateUtc: '2025-11-15T10:00:00Z',
        instrumentCurrency: 'EUR',
      },
    ];

    const result = TaxTimeTestService.analyzeHolding(valuation, lots, 'CZK', refDate);

    expect(result.totalQuantity).toBe(20);
    expect(result.exemptQuantity).toBe(10);
    expect(result.lockedQuantity).toBe(10);
    expect(result.exemptPercentage).toBe(50.0);

    // Lot 1: 10 pcs * 600 EUR * 25.25 CZK ~ 151500 CZK
    expect(result.exemptMarketValueTarget).toBeGreaterThan(140000);

    // 15% tax saved on exempt gain
    expect(result.estimatedTaxSavedTarget).toBeGreaterThan(0);

    // Next unlock: Lot 2 unlocks on 2028-11-15
    expect(result.nextUnlockDate).toBe('2028-11-15');
    expect(result.daysToNextUnlock).toBeGreaterThan(700);
  });

  it('correctly groups assets across multiple brokers (Berkshire XTB + DEGIRO)', () => {
    const refDate = new Date('2026-10-26T00:00:00Z');

    const accounts = [
      { id: 'xtb-usd', brokerId: 'XTB' as const, accountNumber: '2235930', name: 'XTB USD', baseCurrency: 'USD' as const, cashBalances: { CZK: 0, USD: 0, EUR: 0, GBP: 0 }, lastImportAt: '' },
      { id: 'degiro-eur', brokerId: 'DEGIRO' as const, accountNumber: 'Degiro-Main', name: 'Degiro EUR', baseCurrency: 'EUR' as const, cashBalances: { CZK: 0, USD: 0, EUR: 0, GBP: 0 }, lastImportAt: '' },
    ];

    const valuations: ValuationDetail[] = [
      // XTB holding: 158 ks BRKB.US
      {
        holding: {
          id: 'xtb-usd:BRK-B',
          accountId: 'xtb-usd',
          brokerId: 'XTB',
          rawTicker: 'BRKB.US',
          normalizedTicker: 'BRK-B',
          name: 'Berkshire Hathaway Inc Class B',
          assetClass: 'EQUITY',
          instrumentCurrency: 'USD',
          totalQuantity: 158,
          averageOpenPrice: 380,
          currentPrice: 540,
          lastPriceUpdate: refDate.toISOString(),
          tags: ['US Equity'],
        },
        quantity: 158,
        instrumentCurrency: 'USD',
        currentPriceNative: 540,
        costBasisNative: 158 * 380,
        marketValueNative: 158 * 540,
        unrealizedProfitNative: 158 * 160,
        unrealizedProfitPercent: 42.1,
        targetCurrency: 'CZK',
        exchangeRateNativeToTarget: 23.5,
        currentPriceTarget: 540 * 23.5,
        costBasisTarget: 158 * 380 * 23.5,
        marketValueTarget: 158 * 540 * 23.5,
        unrealizedProfitTarget: 158 * 160 * 23.5,
        pureAssetGainTarget: 158 * 160 * 23.5,
        fxGainTarget: 0,
        weightInPortfolio: 80,
      },
      // Degiro holding: 4 ks BRK-B
      {
        holding: {
          id: 'degiro-eur:BRK-B',
          accountId: 'degiro-eur',
          brokerId: 'DEGIRO',
          rawTicker: 'BRK-B',
          normalizedTicker: 'BRK-B',
          name: 'BERKSHIRE HATHAWAY INC CLASS B',
          assetClass: 'EQUITY',
          instrumentCurrency: 'USD',
          totalQuantity: 4,
          averageOpenPrice: 310,
          currentPrice: 540,
          lastPriceUpdate: refDate.toISOString(),
          tags: ['US Equity'],
        },
        quantity: 4,
        instrumentCurrency: 'USD',
        currentPriceNative: 540,
        costBasisNative: 4 * 310,
        marketValueNative: 4 * 540,
        unrealizedProfitNative: 4 * 230,
        unrealizedProfitPercent: 74.2,
        targetCurrency: 'CZK',
        exchangeRateNativeToTarget: 23.5,
        currentPriceTarget: 540 * 23.5,
        costBasisTarget: 4 * 310 * 23.5,
        marketValueTarget: 4 * 540 * 23.5,
        unrealizedProfitTarget: 4 * 230 * 23.5,
        pureAssetGainTarget: 4 * 230 * 23.5,
        fxGainTarget: 0,
        weightInPortfolio: 20,
      },
    ];

    const lots: PositionLot[] = [
      // Degiro lot: 4 ks bought in 2021 (5 years ago) -> EXEMPT
      {
        id: 'deg-lot-1',
        accountId: 'degiro-eur',
        holdingId: 'degiro-eur:BRK-B',
        ticketId: 't-deg-1',
        type: 'BUY',
        quantity: 4,
        openPrice: 310,
        openDateUtc: '2021-06-15T10:00:00Z',
        instrumentCurrency: 'USD',
      },
      // XTB lot 1: 18 ks bought in 2022 (4 years ago) -> EXEMPT
      {
        id: 'xtb-lot-1',
        accountId: 'xtb-usd',
        holdingId: 'xtb-usd:BRK-B',
        ticketId: 't-xtb-1',
        type: 'BUY',
        quantity: 18,
        openPrice: 320,
        openDateUtc: '2022-10-01T10:00:00Z',
        instrumentCurrency: 'USD',
      },
      // XTB lot 2: 140 ks bought in 2024 (2 years ago) -> LOCKED
      {
        id: 'xtb-lot-2',
        accountId: 'xtb-usd',
        holdingId: 'xtb-usd:BRK-B',
        ticketId: 't-xtb-2',
        type: 'BUY',
        quantity: 140,
        openPrice: 390,
        openDateUtc: '2024-05-20T10:00:00Z',
        instrumentCurrency: 'USD',
      },
    ];

    const summary = TaxTimeTestService.calculateGroupedSummary(valuations, lots, accounts, 'CZK', refDate);

    expect(summary.groupedHoldings.length).toBe(1);
    const brk = summary.groupedHoldings[0];

    expect(brk.canonicalTicker).toBe('BRK-B');
    // Total Berkshire = 158 + 4 = 162 ks
    expect(brk.totalQuantity).toBe(162);
    // Exempt Berkshire = 4 (Degiro) + 18 (XTB) = 22 ks
    expect(brk.exemptQuantity).toBe(22);
    // Locked Berkshire = 140 ks
    expect(brk.lockedQuantity).toBe(140);
    // Exempt % = 22 / 162 = 13.6%
    expect(brk.exemptPercentage).toBe(13.6);

    // Brokers breakdown has both XTB and DEGIRO
    expect(brk.brokers.length).toBe(2);
    const xtbBroker = brk.brokers.find(b => b.brokerId === 'XTB');
    const degBroker = brk.brokers.find(b => b.brokerId === 'DEGIRO');
    expect(xtbBroker?.totalQuantity).toBe(158);
    expect(xtbBroker?.exemptQuantity).toBe(18);
    expect(degBroker?.totalQuantity).toBe(4);
    expect(degBroker?.exemptQuantity).toBe(4);

    // Lots array contains all 3 lots sorted chronologically
    expect(brk.lots.length).toBe(3);
    expect(brk.lots[0].ticketId).toBe('t-deg-1'); // 2021
    expect(brk.lots[1].ticketId).toBe('t-xtb-1'); // 2022
    expect(brk.lots[2].ticketId).toBe('t-xtb-2'); // 2024
    expect(brk.lots[0].isExempt).toBe(true);
    expect(brk.lots[1].isExempt).toBe(true);
    expect(brk.lots[2].isExempt).toBe(false);
  });
});
