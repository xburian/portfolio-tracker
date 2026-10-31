import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { FileSnapshot } from '@/types/broker';
import { DividendService } from '@/lib/services/dividendService';
import { DividendTransaction } from '@/types/dividend';
import { Holding, PositionLot } from '@/types/portfolio';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

describe('Dividend Ingestion & Aggregation Service', () => {
  it('extracts and pairs dividends with withholding tax from real XTB USD statement', async () => {
    const filePath = 'sample_data/XTB_USD_2235930.xlsx';
    if (!fs.existsSync(filePath)) return;

    const buffer = fs.readFileSync(filePath);
    const snapshot: FileSnapshot = {
      fileName: 'XTB_USD_2235930.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.byteLength,
      data: new Uint8Array(buffer).buffer,
    };

    const adapter = new XtbAdapter();
    const result = await adapter.parse(snapshot);

    expect(result.dividends).toBeDefined();
    expect(result.dividends!.length).toBeGreaterThan(50);

    // Check pairing on sample dividend (e.g. O.US or NVDA.US)
    const realtyDiv = result.dividends!.find(d => d.rawTicker === 'O.US');
    expect(realtyDiv).toBeDefined();
    expect(realtyDiv!.grossAmount).toBeGreaterThan(0);
    expect(realtyDiv!.withholdingTax).toBeGreaterThan(0);
    expect(realtyDiv!.netAmount).toBe(realtyDiv!.grossAmount - realtyDiv!.withholdingTax);
    expect(realtyDiv!.yearMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(realtyDiv!.currency).toBe('USD');
  });

  it('extracts and pairs European dividends from real XTB EUR statement (ASML.NL)', async () => {
    const filePath = 'sample_data/XTB_EUR_2235931.xlsx';
    if (!fs.existsSync(filePath)) return;

    const buffer = fs.readFileSync(filePath);
    const snapshot: FileSnapshot = {
      fileName: 'XTB_EUR_2235931.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.byteLength,
      data: new Uint8Array(buffer).buffer,
    };

    const adapter = new XtbAdapter();
    const result = await adapter.parse(snapshot);

    expect(result.dividends).toBeDefined();
    expect(result.dividends!.length).toBeGreaterThan(0);

    const asmlDiv = result.dividends!.find(d => d.rawTicker.includes('ASML'));
    expect(asmlDiv).toBeDefined();
    expect(asmlDiv!.currency).toBe('EUR');
    expect(asmlDiv!.grossAmount).toBeGreaterThan(0);
    expect(asmlDiv!.netAmount).toBeLessThanOrEqual(asmlDiv!.grossAmount);
  });

  it('extracts Czech domestic dividends from real XTB CZK statement (KOMB.CZ)', async () => {
    const filePath = 'sample_data/XTB_CZK_1726393.xlsx';
    if (!fs.existsSync(filePath)) return;

    const buffer = fs.readFileSync(filePath);
    const snapshot: FileSnapshot = {
      fileName: 'XTB_CZK_1726393.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.byteLength,
      data: new Uint8Array(buffer).buffer,
    };

    const adapter = new XtbAdapter();
    const result = await adapter.parse(snapshot);

    expect(result.dividends).toBeDefined();
    expect(result.dividends!.length).toBeGreaterThan(0);

    const kombDiv = result.dividends!.find(d => d.rawTicker.includes('KOMB') || d.comment?.includes('KOMB'));
    expect(kombDiv).toBeDefined();
    expect(kombDiv!.currency).toBe('CZK');
    expect(kombDiv!.grossAmount).toBeGreaterThan(0);
  });

  it('correctly aggregates dividends by month in chronological order across multiple years', () => {
    const mockDividends: DividendTransaction[] = [
      {
        id: 'div-1',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'AAPL.US',
        normalizedTicker: 'AAPL',
        paymentDateUtc: '2023-11-15T10:00:00.000Z',
        yearMonth: '2023-11',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 23.0,
        grossAmountCZK: 2300,
        withholdingTaxCZK: 345,
        netAmountCZK: 1955,
      },
      {
        id: 'div-2',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'MSFT.US',
        normalizedTicker: 'MSFT',
        paymentDateUtc: '2024-05-20T10:00:00.000Z',
        yearMonth: '2024-05',
        grossAmount: 200,
        withholdingTax: 30,
        netAmount: 170,
        currency: 'USD',
        fxRateToCZK: 23.5,
        grossAmountCZK: 4700,
        withholdingTaxCZK: 705,
        netAmountCZK: 3995,
      },
      {
        id: 'div-3',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-05-22T10:00:00.000Z',
        yearMonth: '2024-05',
        grossAmount: 50,
        withholdingTax: 7.5,
        netAmount: 42.5,
        currency: 'USD',
        fxRateToCZK: 23.5,
        grossAmountCZK: 1175,
        withholdingTaxCZK: 176.25,
        netAmountCZK: 998.75,
      },
      {
        id: 'div-4',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-06-15T10:00:00.000Z',
        yearMonth: '2024-06',
        grossAmount: 50,
        withholdingTax: 7.5,
        netAmount: 42.5,
        currency: 'USD',
        fxRateToCZK: 23.0,
        grossAmountCZK: 1150,
        withholdingTaxCZK: 172.5,
        netAmountCZK: 977.5,
      },
    ];

    const monthly = DividendService.aggregateByMonth(mockDividends);
    expect(monthly.length).toBe(3);
    expect(monthly[0].yearMonth).toBe('2023-11');
    expect(monthly[0].transactionsCount).toBe(1);
    expect(monthly[0].totalNetCZK).toBe(1955);

    expect(monthly[1].yearMonth).toBe('2024-05');
    expect(monthly[1].transactionsCount).toBe(2);
    expect(monthly[1].totalNetCZK).toBe(3995 + 998.75);

    expect(monthly[2].yearMonth).toBe('2024-06');
    expect(monthly[2].transactionsCount).toBe(1);
    expect(monthly[2].totalNetCZK).toBe(977.5);

    const overall = DividendService.calculateOverallSummary(mockDividends);
    expect(overall.count).toBe(4);
    expect(overall.totalNetCZK).toBe(1955 + 3995 + 998.75 + 977.5);
    expect(overall.avgMonthlyNetCZK).toBeCloseTo((1955 + 3995 + 998.75 + 977.5) / 3, 2);
    expect(overall.effectiveTaxRate).toBeCloseTo(15.0, 1);
  });

  it('aggregates per holding and calculates Yield on Cost (YoC)', () => {
    const mockDividends: DividendTransaction[] = [
      {
        id: 'div-1',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-05-15T10:00:00.000Z',
        yearMonth: '2024-05',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 24.0,
        grossAmountCZK: 2400,
        withholdingTaxCZK: 360,
        netAmountCZK: 2040,
      },
      {
        id: 'div-2',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-06-15T10:00:00.000Z',
        yearMonth: '2024-06',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 24.0,
        grossAmountCZK: 2400,
        withholdingTaxCZK: 360,
        netAmountCZK: 2040,
      },
    ];

    const mockHoldings: Holding[] = [
      {
        id: 'acc-1:O',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        name: 'Realty Income Corp.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'USD',
        totalQuantity: 20,
        averageOpenPrice: 50, // Cost = 20 * 50 = $1,000
        currentPrice: 55,
        lastPriceUpdate: new Date().toISOString(),
        tags: [],
      },
    ];

    const mockLots: PositionLot[] = [
      {
        id: 'lot-1',
        accountId: 'acc-1',
        holdingId: 'acc-1:O',
        ticketId: 't-1',
        type: 'BUY',
        quantity: 20,
        openPrice: 50,
        openDateUtc: '2023-01-01T00:00:00Z',
        instrumentCurrency: 'USD',
      },
    ];

    const holdingStats = DividendService.aggregateByHolding(mockDividends, mockHoldings, mockLots);
    expect(holdingStats.length).toBe(1);
    const o = holdingStats[0];
    expect(o.normalizedTicker).toBe('O');
    expect(o.name).toBe('Realty Income Corp.');
    expect(o.totalNetCZK).toBe(4080);
    expect(o.totalGrossCZK).toBe(4800);
    expect(o.effectiveTaxRate).toBe(15.0);
    // Net div = 4080 CZK / Cost native = (1000) -> YoC % is positive and reflects return on capital
    expect(o.yieldOnCost).toBeGreaterThan(0);
    expect(o.lastPaymentDate).toBe('2024-06-15T10:00:00.000Z');
  });

  it('multi-currency isolation: correctly distinguishes USD, EUR, and CZK dividends within the same CZK account statement', async () => {
    const filePath = 'sample_data/XTB_CZK_1726393.xlsx';
    if (!fs.existsSync(filePath)) return;

    const buffer = fs.readFileSync(filePath);
    const snapshot: FileSnapshot = {
      fileName: 'XTB_CZK_1726393.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.byteLength,
      data: new Uint8Array(buffer).buffer,
    };

    const adapter = new XtbAdapter();
    const result = await adapter.parse(snapshot);

    expect(result.dividends).toBeDefined();

    // 1. Apple US Stock dividend must be recognized as USD, NOT CZK
    const aaplDiv = result.dividends!.find(d => d.rawTicker.includes('AAPL'));
    expect(aaplDiv).toBeDefined();
    expect(aaplDiv!.currency).toBe('USD');
    // $1.67 USD at ~23.27 CZK/USD should be ~38.86 CZK, NOT 1.67 CZK!
    expect(aaplDiv!.fxRateToCZK).toBeGreaterThan(20);
    expect(aaplDiv!.grossAmountCZK).toBeGreaterThan(30);

    // 2. Komerční Banka Czech dividend must be recognized as CZK
    const kombDiv = result.dividends!.find(d => d.rawTicker.includes('KOMB') || d.comment?.includes('KOMB'));
    expect(kombDiv).toBeDefined();
    expect(kombDiv!.currency).toBe('CZK');
    expect(kombDiv!.fxRateToCZK).toBe(1.0);
    expect(kombDiv!.grossAmountCZK).toBe(kombDiv!.grossAmount);
  });

  it('useCurrencyStore.formatCurrency converts amount from CZK to target currency instead of appending symbol', () => {
    const { formatCurrency } = useCurrencyStore.getState();
    const formattedCZK = formatCurrency(25000, 'CZK');
    expect(formattedCZK).toContain('Kč');
    expect(formattedCZK).toContain('25');

    const formattedUSD = formatCurrency(25000, 'USD');
    // 25,000 CZK / ~23.27 = ~$1,074
    expect(formattedUSD).toContain('$');
    expect(formattedUSD).not.toContain('25 000');
    expect(formattedUSD).not.toContain('25,000');

    const formattedEUR = formatCurrency(25000, 'EUR');
    // 25,000 CZK / 25.25 = ~990 €
    expect(formattedEUR).toContain('€');
    expect(formattedEUR).not.toContain('25 000');
  });

  it('handles empty dividend lists defensively with zero stats', () => {
    const emptyMonthly = DividendService.aggregateByMonth([]);
    expect(emptyMonthly).toEqual([]);

    const emptyHoldings = DividendService.aggregateByHolding([]);
    expect(emptyHoldings).toEqual([]);

    const summary = DividendService.calculateOverallSummary([]);
    expect(summary.count).toBe(0);
    expect(summary.totalNetCZK).toBe(0);
    expect(summary.totalGrossCZK).toBe(0);
    expect(summary.avgMonthlyNetCZK).toBe(0);
    expect(summary.effectiveTaxRate).toBe(0);

    const emptyYears = DividendService.getAvailableYears([]);
    expect(emptyYears).toEqual([]);

    const emptyAnnual = DividendService.aggregateByYear([]);
    expect(emptyAnnual).toEqual([]);
  });

  describe('Period & Annual Dividend Aggregation (Senior Engineering Suite)', () => {
    const mockMultiYearDividends: DividendTransaction[] = [
      {
        id: 'div-2024-1',
        profileId: 'p1',
        accountId: 'a1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-03-15T12:00:00.000Z',
        yearMonth: '2024-03',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 23.0,
        grossAmountCZK: 2300,
        withholdingTaxCZK: 345,
        netAmountCZK: 1955,
      },
      {
        id: 'div-2024-2',
        profileId: 'p1',
        accountId: 'a1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2024-09-15T12:00:00.000Z',
        yearMonth: '2024-09',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 23.0,
        grossAmountCZK: 2300,
        withholdingTaxCZK: 345,
        netAmountCZK: 1955,
      },
      {
        id: 'div-2025-1',
        profileId: 'p1',
        accountId: 'a1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2025-06-15T12:00:00.000Z',
        yearMonth: '2025-06',
        grossAmount: 200,
        withholdingTax: 30,
        netAmount: 170,
        currency: 'USD',
        fxRateToCZK: 24.0,
        grossAmountCZK: 4800,
        withholdingTaxCZK: 720,
        netAmountCZK: 4080,
      },
      {
        id: 'div-2026-1',
        profileId: 'p1',
        accountId: 'a1',
        brokerId: 'XTB',
        rawTicker: 'O.US',
        normalizedTicker: 'O',
        paymentDateUtc: '2026-02-15T12:00:00.000Z',
        yearMonth: '2026-02',
        grossAmount: 150,
        withholdingTax: 22.5,
        netAmount: 127.5,
        currency: 'USD',
        fxRateToCZK: 24.0,
        grossAmountCZK: 3600,
        withholdingTaxCZK: 540,
        netAmountCZK: 3060,
      },
    ];

    it('getAvailableYears extracts distinct years sorted descending', () => {
      const years = DividendService.getAvailableYears(mockMultiYearDividends);
      expect(years).toEqual(['2026', '2025', '2024']);
    });

    it('filterByPeriod filters by calendar year correctly', () => {
      const divs2024 = DividendService.filterByPeriod(mockMultiYearDividends, '2024');
      expect(divs2024.length).toBe(2);
      expect(divs2024.every(d => d.yearMonth.startsWith('2024'))).toBe(true);

      const divs2025 = DividendService.filterByPeriod(mockMultiYearDividends, '2025');
      expect(divs2025.length).toBe(1);
      expect(divs2025[0].id).toBe('div-2025-1');

      const divsAll = DividendService.filterByPeriod(mockMultiYearDividends, 'ALL');
      expect(divsAll.length).toBe(4);
    });

    it('filterByPeriod filters YTD and 1Y relative to reference date', () => {
      // Simulate reference date in October 2026
      const refDate = new Date('2026-10-30T12:00:00Z');

      const divsYTD = DividendService.filterByPeriod(mockMultiYearDividends, 'YTD', refDate);
      expect(divsYTD.length).toBe(1);
      expect(divsYTD[0].id).toBe('div-2026-1');

      // 1Y from 2026-10-30 covers back to 2025-10-30
      // mockMultiYearDividends has 2026-02-15 (within 1Y) and 2025-06-15 (>1Y ago)
      const divs1Y = DividendService.filterByPeriod(mockMultiYearDividends, '1Y', refDate);
      expect(divs1Y.length).toBe(1);
      expect(divs1Y[0].id).toBe('div-2026-1');

      // 3Y from 2026-10-30 covers back to 2023-10-30
      const divs3Y = DividendService.filterByPeriod(mockMultiYearDividends, '3Y', refDate);
      expect(divs3Y.length).toBe(4);
    });

    it('aggregateByYear computes accurate annual sums, YoY growth and monthly averages', () => {
      // Reference date: Month 10 of 2026
      const refDate = new Date('2026-10-15T00:00:00Z');
      const annual = DividendService.aggregateByYear(mockMultiYearDividends, refDate);

      expect(annual.length).toBe(3);
      // Sorted descending: 2026, 2025, 2024
      const [yr2026, yr2025, yr2024] = annual;

      // 2024 stats:
      // Net: 1955 + 1955 = 3910 CZK
      // Gross: 2300 + 2300 = 4600 CZK
      // Tax: 345 + 345 = 690 CZK
      // Effective tax: 690 / 4600 = 15.0%
      // Monthly avg: 3910 / 12 = 325.83 CZK
      // YoY: undefined (oldest year)
      expect(yr2024.year).toBe('2024');
      expect(yr2024.isYTD).toBe(false);
      expect(yr2024.totalNetCZK).toBe(3910);
      expect(yr2024.totalGrossCZK).toBe(4600);
      expect(yr2024.effectiveTaxRate).toBe(15.0);
      expect(yr2024.monthlyAverageCZK).toBe(325.83);
      expect(yr2024.yoyGrowthPercent).toBeUndefined();

      // 2025 stats:
      // Net: 4080 CZK
      // Monthly avg: 4080 / 12 = 340 CZK
      // YoY: (4080 - 3910) / 3910 * 100 = 4.35% -> rounded to 4.3%
      expect(yr2025.year).toBe('2025');
      expect(yr2025.isYTD).toBe(false);
      expect(yr2025.totalNetCZK).toBe(4080);
      expect(yr2025.monthlyAverageCZK).toBe(340);
      expect(yr2025.yoyGrowthPercent).toBe(4.3);

      // 2026 stats (YTD in October -> 10 months elapsed):
      // Net: 3060 CZK
      // Monthly avg (YTD run-rate): 3060 / 10 = 306 CZK
      // YoY: (3060 - 4080) / 4080 * 100 = -25.0%
      expect(yr2026.year).toBe('2026');
      expect(yr2026.isYTD).toBe(true);
      expect(yr2026.totalNetCZK).toBe(3060);
      expect(yr2026.monthlyAverageCZK).toBe(306);
      expect(yr2026.yoyGrowthPercent).toBe(-25.0);
    });

    it('processes real historical XTB USD multi-year statement with annual aggregation', async () => {
      const filePath = 'sample_data/XTB_USD_2235930.xlsx';
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const snapshot: FileSnapshot = {
        fileName: 'XTB_USD_2235930.xlsx',
        fileExtension: '.xlsx',
        sizeBytes: buffer.byteLength,
        data: new Uint8Array(buffer).buffer,
      };

      const adapter = new XtbAdapter();
      const result = await adapter.parse(snapshot);
      expect(result.dividends).toBeDefined();

      const years = DividendService.getAvailableYears(result.dividends!);
      expect(years.length).toBeGreaterThan(1);

      const annual = DividendService.aggregateByYear(result.dividends!);
      expect(annual.length).toBe(years.length);

      for (const row of annual) {
        expect(row.totalNetCZK).toBeGreaterThan(0);
        expect(row.totalGrossCZK).toBeGreaterThanOrEqual(row.totalNetCZK);
        expect(row.transactionsCount).toBeGreaterThan(0);
        expect(row.monthlyAverageCZK).toBeGreaterThan(0);
        expect(row.effectiveTaxRate).toBeGreaterThan(0);
      }
    });
  });
});
