import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { FileSnapshot } from '@/types/broker';
import { DividendService } from '@/lib/services/dividendService';
import { DividendTransaction } from '@/types/dividend';
import { Holding, PositionLot } from '@/types/portfolio';

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
  });
});
