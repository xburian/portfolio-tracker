import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { XtbAdapter } from '@/lib/parsers/xtbParser';
import { FileSnapshot } from '@/types/broker';

describe('XTB Parser on Real Export Files', () => {
  const adapter = new XtbAdapter();

  const czkPath = process.env.TEST_XTB_CZK || './sample_data/XTB_CZK_1726393.xlsx';
  const usdPath = process.env.TEST_XTB_USD || './sample_data/XTB_USD_2235930.xlsx';
  const eurPath = process.env.TEST_XTB_EUR || './sample_data/XTB_EUR_2235931.xlsx';

  it('correctly parses CZK Account with SXR8.DE, MONET.CZ, RBAG.CZ', async () => {
    if (!existsSync(czkPath)) return;

    const buffer = readFileSync(czkPath);
    const snapshot: FileSnapshot = {
      fileName: 'CZK_1726393.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);

    const result = await adapter.parse(snapshot);
    expect(result.account.brokerId).toBe('XTB');
    expect(result.account.accountNumber).toBe('1726393');
    expect(result.account.baseCurrency).toBe('CZK');

    expect(result.holdings.length).toBeGreaterThan(0);
    expect(result.lots.length).toBeGreaterThan(0);

    const sxr8 = result.holdings.find(h => h.rawTicker === 'SXR8.DE');
    expect(sxr8).toBeDefined();
    expect(sxr8?.name).toContain('Core S&P 500');

    // Total volume of SXR8 lots must equal 7.0
    const sxr8Lots = result.lots.filter(l => l.holdingRawTicker === 'SXR8.DE');
    const totalSxr8Vol = sxr8Lots.reduce((acc, l) => acc + l.quantity, 0);
    expect(totalSxr8Vol).toBeCloseTo(7.0, 4);

    // Moneta volume must equal 92
    const monet = result.holdings.find(h => h.rawTicker === 'MONET.CZ');
    expect(monet).toBeDefined();
    const monetLots = result.lots.filter(l => l.holdingRawTicker === 'MONET.CZ');
    const totalMonetVol = monetLots.reduce((acc, l) => acc + l.quantity, 0);
    expect(totalMonetVol).toBeCloseTo(92.0, 4);
  });

  it('correctly parses USD Account with VUAA.UK, BRKB.US, GOOGL.US', async () => {
    if (!existsSync(usdPath)) return;

    const buffer = readFileSync(usdPath);
    const snapshot: FileSnapshot = {
      fileName: 'USD_2235930.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    const result = await adapter.parse(snapshot);
    expect(result.account.accountNumber).toBe('2235930');
    expect(result.account.baseCurrency).toBe('USD');

    const vuaa = result.holdings.find(h => h.rawTicker === 'VUAA.UK');
    expect(vuaa).toBeDefined();
    expect(vuaa?.name).toContain('S&P 500');

    const brkb = result.holdings.find(h => h.rawTicker === 'BRKB.US');
    expect(brkb).toBeDefined();

    const googl = result.holdings.find(h => h.rawTicker === 'GOOGL.US');
    expect(googl).toBeDefined();
  });

  it('correctly parses EUR Account with ASML, HEIJM, VWCE.DE, EGLN.UK', async () => {
    if (!existsSync(eurPath)) return;

    const buffer = readFileSync(eurPath);
    const snapshot: FileSnapshot = {
      fileName: 'EUR_2235931.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    const result = await adapter.parse(snapshot);
    expect(result.account.accountNumber).toBe('2235931');
    expect(result.account.baseCurrency).toBe('EUR');

    const asml = result.holdings.find(h => h.rawTicker === 'ASML.NL');
    expect(asml).toBeDefined();

    const vwce = result.holdings.find(h => h.rawTicker === 'VWCE.DE');
    expect(vwce).toBeDefined();

    const egln = result.holdings.find(h => h.rawTicker === 'EGLN.UK');
    expect(egln).toBeDefined();
  });
});
