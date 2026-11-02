import { describe, it, expect } from 'bun:test';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { DegiroAdapter } from '@/lib/parsers/degiroParser';
import { PerformanceService } from '@/lib/services/performanceService';
import fs from 'fs';
import path from 'path';

describe('Closed Positions Ingestion & Performance Trackers', () => {
  const sampleDir = path.resolve(process.cwd(), 'sample_data');

  it('XTB Parser extracts real closed positions from statement with tax-test data', async () => {
    const adapter = new XtbAdapter();
    const filePath = path.join(sampleDir, 'XTB_USD_2235930.xlsx');
    if (!fs.existsSync(filePath)) {
      console.warn('Skipping XTB test: sample file not found');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await adapter.parse({
      fileName: 'XTB_USD_2235930.xlsx',
      fileExtension: '.xlsx',
      data: new Uint8Array(buffer),
    });

    expect(result.closedPositions).toBeDefined();
    expect(result.closedPositions!.length).toBeGreaterThan(50);

    const first = result.closedPositions![0];
    expect(first.accountId).toBe('xtb-2235930');
    expect(first.brokerId).toBe('XTB');
    expect(first.volume).toBeGreaterThan(0);
    expect(first.openPrice).toBeGreaterThan(0);
    expect(first.closePrice).toBeGreaterThan(0);
    expect(first.holdingPeriodDays).toBeGreaterThanOrEqual(0);
    expect(first.purchaseValueNative).toBeGreaterThan(0);
    expect(first.saleValueNative).toBeGreaterThan(0);
    expect(typeof first.profitNative).toBe('number');
    expect(typeof first.isTimeTestExempt).toBe('boolean');

    // Verify Czech 3-year time test condition: holding >= 1096 days
    for (const cp of result.closedPositions!) {
      if (cp.holdingPeriodDays >= 1096) {
        expect(cp.isTimeTestExempt).toBe(true);
      } else {
        expect(cp.isTimeTestExempt).toBe(false);
      }
    }
  });

  it('DEGIRO Parser generates FIFO closed positions from sell transactions', async () => {
    const adapter = new DegiroAdapter();
    const filePath = path.join(sampleDir, 'Degiro_EUR.xlsx');
    if (!fs.existsSync(filePath)) {
      console.warn('Skipping DEGIRO test: sample file not found');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await adapter.parse({
      fileName: 'Degiro_EUR.xlsx',
      fileExtension: '.xlsx',
      data: new Uint8Array(buffer),
    });

    expect(result.closedPositions).toBeDefined();
    expect(result.closedPositions!.length).toBeGreaterThan(10);

    // Verify DEGIRO closed positions include Apple or AT&T
    const appleTrades = result.closedPositions!.filter((p) => p.name.includes('APPLE') || p.rawTicker === 'AAPL');
    expect(appleTrades.length).toBeGreaterThan(0);

    // Verify holding period days calculation
    const trade = appleTrades[0];
    expect(trade.holdingPeriodDays).toBeGreaterThan(0);
    expect(trade.purchaseValueNative).toBeGreaterThan(0);
    expect(trade.saleValueNative).toBeGreaterThan(0);

    // Find any trades with holding > 3 years (1096 days)
    const longTermTrades = result.closedPositions!.filter((p) => p.holdingPeriodDays >= 1096);
    expect(longTermTrades.length).toBeGreaterThan(0);
    for (const lt of longTermTrades) {
      expect(lt.isTimeTestExempt).toBe(true);
      if (lt.profitTarget > 0) {
        expect(lt.estimatedTaxSavedTarget).toBeGreaterThan(0);
      }
    }
  });

  it('calculates monthly performance matrix with positive win rate and YTD', () => {
    const matrix = PerformanceService.calculateMonthlyReturnsMatrix(
      [],
      [
        {
          id: 'lot-1',
          accountId: 'acc-1',
          holdingId: 'h-1',
          ticketId: 't-1',
          type: 'BUY',
          quantity: 10,
          openPrice: 100,
          openDateUtc: '2024-01-15T10:00:00Z',
          instrumentCurrency: 'CZK',
        },
      ],
      [],
      'CZK',
      [],
      []
    );

    expect(matrix.years.length).toBeGreaterThanOrEqual(1);
    expect(matrix.totalMonthsCount).toBeGreaterThan(0);
    expect(matrix.winRateMonthsPercent).toBeGreaterThanOrEqual(0);
    expect(typeof matrix.averageMonthlyReturnPercent).toBe('number');
    expect(typeof matrix.annualizedCagrPercent).toBe('number');
  });

  it('calculates drawdown analysis with ATH distance and max drawdown', () => {
    const trajectory = [
      { date: '2024-01-01', label: 'Led 24', value: 100000, invested: 100000, profit: 0 },
      { date: '2024-02-01', label: 'Úno 24', value: 115000, invested: 100000, profit: 15000 },
      { date: '2024-03-01', label: 'Bře 24', value: 95000, invested: 100000, profit: -5000 },
      { date: '2024-04-01', label: 'Dub 24', value: 120000, invested: 100000, profit: 20000 },
    ];

    const dd = PerformanceService.calculateDrawdownAnalysis(trajectory, 120000);

    expect(dd.currentAthValueTarget).toBe(120000);
    expect(dd.currentDrawdownPercent).toBe(0); // At ATH
    expect(dd.maxDrawdownPercent).toBeLessThan(0); // -17.4% at March
    expect(dd.trajectory.length).toBe(4);
  });

  it('calculates fee audit with commissions, FX drag and 20-year compound loss', () => {
    const closedPositions = [
      {
        id: 'cp-1',
        accountId: 'acc-1',
        brokerId: 'XTB' as const,
        rawTicker: 'AAPL',
        normalizedTicker: 'AAPL',
        name: 'Apple Inc',
        assetClass: 'EQUITY' as const,
        instrumentCurrency: 'USD' as const,
        volume: 10,
        openPrice: 150,
        openDateUtc: '2023-01-01T00:00:00Z',
        closePrice: 180,
        closeDateUtc: '2023-10-01T00:00:00Z',
        holdingPeriodDays: 273,
        purchaseValueNative: 1500,
        saleValueNative: 1800,
        profitNative: 300,
        profitPercent: 20,
        commissionNative: 2,
        purchaseValueTarget: 34500,
        saleValueTarget: 41400,
        profitTarget: 6900,
        commissionTarget: 46,
        isTimeTestExempt: false,
        estimatedTaxSavedTarget: 0,
      },
    ];

    const audit = PerformanceService.calculateFeeAudit(closedPositions, [], [], 'CZK');

    expect(audit.totalCommissionsTarget).toBeGreaterThan(0);
    expect(audit.totalFxSpreadFeesTarget).toBeGreaterThan(0);
    expect(audit.totalFeesPaidTarget).toBeGreaterThan(0);
    expect(audit.compoundedLoss20YearsTarget).toBeGreaterThan(audit.totalFeesPaidTarget);
  });
});
