import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { FileSnapshot } from '@/types/broker';
import { DividendService } from '@/lib/services/dividendService';
import { DividendTransaction } from '@/types/dividend';

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
  });

  it('correctly aggregates dividends by month in chronological order', () => {
    const mockDividends: DividendTransaction[] = [
      {
        id: 'div-1',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'AAPL.US',
        normalizedTicker: 'AAPL',
        paymentDateUtc: '2024-05-15T10:00:00.000Z',
        yearMonth: '2024-05',
        grossAmount: 100,
        withholdingTax: 15,
        netAmount: 85,
        currency: 'USD',
        fxRateToCZK: 23.5,
        grossAmountCZK: 2350,
        withholdingTaxCZK: 352.5,
        netAmountCZK: 1997.5,
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
    expect(monthly.length).toBe(2);
    expect(monthly[0].yearMonth).toBe('2024-05');
    expect(monthly[0].transactionsCount).toBe(2);
    expect(monthly[0].totalNetCZK).toBe(1997.5 + 3995);
    expect(monthly[1].yearMonth).toBe('2024-06');
    expect(monthly[1].totalNetCZK).toBe(977.5);

    const overall = DividendService.calculateOverallSummary(mockDividends);
    expect(overall.count).toBe(3);
    expect(overall.totalNetCZK).toBe(1997.5 + 3995 + 977.5);
    expect(overall.effectiveTaxRate).toBeCloseTo(15.0, 1);
  });
});
