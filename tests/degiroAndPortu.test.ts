import { describe, it, expect } from 'vitest';
import { DegiroAdapter } from '@/lib/parsers/degiroParser';
import { PortuAdapter } from '@/lib/parsers/portuParser';
import { IbkrAdapter } from '@/lib/parsers/ibkrParser';
import { FileSnapshot } from '@/types/broker';

describe('Degiro, Portu and IBKR Parsers', () => {
  it('parses real user Degiro transaction export with FIFO lot depletion', async () => {
    const filePath = process.env.TEST_DEGIRO_CSV || './degiro_transactions.csv';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const fileText = readFileSync(filePath, 'utf-8');
    const adapter = new DegiroAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'degiro_transactions.csv',
      fileExtension: '.csv',
      sizeBytes: fileText.length,
      data: fileText,
    };

    const result = await adapter.parse(snapshot);
    expect(result.account.brokerId).toBe('DEGIRO');

    // Only active open positions should be present (closed ones like Apple, CEZ, Disney, Palantir have net 0)
    const openTickers = result.holdings.map(h => h.rawTicker);
    expect(openTickers).toContain('IWDA.AS'); // MSCI World (420 shares)
    expect(openTickers).toContain('QDVE.DE'); // S&P 500 Info Tech (166 shares)
    expect(openTickers).toContain('SMH.MI');  // Semiconductor (115 shares)
    expect(openTickers).toContain('VUSA.AS'); // S&P 500 (114 shares)
    expect(openTickers).toContain('IPRP.AS'); // Property Yield (56 shares)
    expect(openTickers).toContain('VWCE.DE'); // All-World (18 shares)
    expect(openTickers).toContain('BRK-B');   // Berkshire (4 shares)
    expect(openTickers).toContain('MSFT');    // Microsoft (2 shares)

    // Closed positions must NOT be in open holdings
    expect(openTickers).not.toContain('AAPL');
    expect(openTickers).not.toContain('CEZ.PR');
    expect(openTickers).not.toContain('DIS');
    expect(openTickers).not.toContain('WBD');
    expect(openTickers).not.toContain('PLTR');
    expect(openTickers).not.toContain('SOFI');

    // Check quantity of MSCI World
    const msciLots = result.lots.filter(l => l.holdingRawTicker === 'IWDA.AS');
    const totalMsci = msciLots.reduce((acc, l) => acc + l.quantity, 0);
    expect(totalMsci).toBeCloseTo(420.0, 4);

    // Check quantity of VUSA (S&P 500)
    const vusaLots = result.lots.filter(l => l.holdingRawTicker === 'VUSA.AS');
    const totalVusa = vusaLots.reduce((acc, l) => acc + l.quantity, 0);
    expect(totalVusa).toBeCloseTo(114.0, 4);
  });

  it('parses real user Degiro Excel (.xlsx) export with FIFO lot depletion', async () => {
    const filePath = process.env.TEST_DEGIRO_XLSX || './degiro_transactions.xlsx';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const buffer = readFileSync(filePath);
    const adapter = new DegiroAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'degiro_transactions.xlsx',
      fileExtension: '.xlsx',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);
    expect(result.account.brokerId).toBe('DEGIRO');

    const openTickers = result.holdings.map(h => h.rawTicker);
    expect(openTickers).toContain('IWDA.AS');
    expect(openTickers).toContain('VUSA.AS');
    expect(openTickers).toContain('QDVE.DE');
    expect(openTickers).toContain('SMH.MI');
    expect(openTickers).not.toContain('AAPL');
    expect(openTickers).not.toContain('DIS');

    const msciLots = result.lots.filter(l => l.holdingRawTicker === 'IWDA.AS');
    const totalMsci = msciLots.reduce((acc, l) => acc + l.quantity, 0);
    expect(totalMsci).toBeCloseTo(420.0, 4);
  });

  it('parses Portu CSV with 6-decimal fraction precision and cash detection', async () => {
    const csvContent = `Instrument;ISIN;Měna;Počet kusů;Nákupní cena;Aktuální cena;Aktuální hodnota v CZK;Nerealizovaný zisk v CZK
iShares Core S&P 500 UCITS ETF;IE00B5BMR087;USD;1,452184;452,12;542,80;19250,42;3240,18
Vanguard FTSE All-World UCITS ETF;IE00BK5BQT80;EUR;3,089201;102,40;118,50;9245,60;1255,10
Hotovost CZK;;CZK;1;1,00;1,00;1450,20;0,00`;

    const adapter = new PortuAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'portu_portfolio.csv',
      fileExtension: '.csv',
      sizeBytes: csvContent.length,
      data: csvContent,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.brokerId).toBe('PORTU');
    expect(result.account.baseCurrency).toBe('CZK');
    expect(result.account.cashBalances.CZK).toBe(1450.2);

    expect(result.holdings.length).toBe(2);
    const sp500 = result.holdings.find(h => h.isin === 'IE00B5BMR087');
    expect(sp500).toBeDefined();

    const spLot = result.lots.find(l => l.holdingRawTicker === 'IE00B5BMR087');
    expect(spLot?.quantity).toBe(1.452184); // exact 6-decimal fraction preserved
  });

  it('parses IBKR Open Positions CSV correctly', async () => {
    const csvContent = `Account Information,Header,Field Name,Field Value
Account Information,Data,Account Capabilities,Margin
Account Information,Data,Base Currency,EUR
Account Information,Data,Account,U9876543
Open Positions,Header,DataDiscriminator,Asset Class,Currency,Symbol,Description,Security ID,Position,Cost Price,Mark Price,Value
Open Positions,Data,Summary,STK,USD,AAPL,APPLE INC,US0378331005,25,165.20,182.50,4562.50
Open Positions,Data,Summary,ETF,EUR,VWCE,VANGUARD FTSE ALL-WORLD,IE00BK5BQT80,50,105.10,118.40,5920.00`;

    const adapter = new IbkrAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'ibkr_statement.csv',
      fileExtension: '.csv',
      sizeBytes: csvContent.length,
      data: csvContent,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.brokerId).toBe('IBKR');
    expect(result.account.accountNumber).toBe('U9876543');
    expect(result.account.baseCurrency).toBe('EUR');

    expect(result.holdings.length).toBe(2);
    const aapl = result.holdings.find(h => h.rawTicker === 'AAPL');
    expect(aapl?.reportedCurrentPrice).toBe(182.5);

    const vwce = result.holdings.find(h => h.rawTicker === 'VWCE');
    expect(vwce?.reportedValue).toBe(5920);
  });

  it('parses real user IBKR MTM Summary CSV with cash and fractional shares', async () => {
    const filePath = './sample_data/IBKR_CZK_U18495305.csv';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const fileText = readFileSync(filePath, 'utf-8');
    const adapter = new IbkrAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'IBKR_CZK_U18495305.csv',
      fileExtension: '.csv',
      sizeBytes: fileText.length,
      data: fileText,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.brokerId).toBe('IBKR');
    expect(result.account.accountNumber).toBe('U18495305');
    expect(result.account.baseCurrency).toBe('CZK');
    expect(result.account.cashBalances.CZK).toBeCloseTo(163.98, 2);

    expect(result.holdings.length).toBe(6);
    const symbols = result.holdings.map(h => h.rawTicker);
    expect(symbols).toContain('VWRA');
    expect(symbols).toContain('CEBZ');
    expect(symbols).toContain('EGLN');
    expect(symbols).toContain('MSFT');
    expect(symbols).toContain('AVGO');
    expect(symbols).toContain('NFLX');

    // Fractional share verification
    const vwra = result.lots.find(l => l.holdingRawTicker === 'VWRA');
    expect(vwra?.quantity).toBe(9.6371);

    const avgo = result.lots.find(l => l.holdingRawTicker === 'AVGO');
    expect(avgo?.quantity).toBe(0.1);

    const egln = result.holdings.find(h => h.rawTicker === 'EGLN');
    expect(egln?.assetClass).toBe('COMMODITY');
  });

  it('parses real user Portu Primary portfolio PDF statement correctly', async () => {
    const filePath = './sample_data/Portu_CZK_13361957.pdf';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const buffer = readFileSync(filePath);
    const adapter = new PortuAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'Portu_CZK_13361957.pdf',
      fileExtension: '.pdf',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.brokerId).toBe('PORTU');
    expect(result.account.accountNumber).toBe('13361957');
    expect(result.account.accountName).toBe('Portu Primary portfolio');
    expect(result.account.baseCurrency).toBe('CZK');
    expect(result.account.cashBalances.EUR).toBeCloseTo(121.65, 2);

    expect(result.holdings.length).toBe(6);
    const tickers = result.holdings.map(h => h.rawTicker);
    expect(tickers).toContain('XMK9 GY');
    expect(tickers).toContain('CSPX LN');
    expect(tickers).toContain('AMEA GY');
    expect(tickers).toContain('IS3N GY');
    expect(tickers).toContain('ZPRS GY');
    expect(tickers).toContain('SXR7 GY');

    // Fractional lot precision
    const xmk9 = result.lots.find(l => l.holdingRawTicker === 'XMK9 GY');
    expect(xmk9?.quantity).toBe(11.2931);
    expect(xmk9?.openPrice).toBe(61.71);
  });

  it('parses real user Portu DIP portfolio PDF statement correctly', async () => {
    const filePath = './sample_data/Portu_DIP_15437415.pdf';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const buffer = readFileSync(filePath);
    const adapter = new PortuAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'Portu_DIP_15437415.pdf',
      fileExtension: '.pdf',
      sizeBytes: buffer.length,
      data: buffer.buffer,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.brokerId).toBe('PORTU');
    expect(result.account.accountNumber).toBe('15437415');
    expect(result.account.accountName).toBe('Portu DIP');
    expect(result.account.baseCurrency).toBe('CZK');
    expect(result.account.cashBalances.CZK).toBeCloseTo(3228.18, 2);

    expect(result.holdings.length).toBe(3);
    const tickers = result.holdings.map(h => h.rawTicker);
    expect(tickers).toContain('CSPX LN');
    expect(tickers).toContain('CNDX LN');
    expect(tickers).toContain('SEC0 GY');

    const cspx = result.lots.find(l => l.holdingRawTicker === 'CSPX LN');
    expect(cspx?.quantity).toBe(6.161);
    expect(cspx?.openPrice).toBe(832.39);

    const cndx = result.lots.find(l => l.holdingRawTicker === 'CNDX LN');
    expect(cndx?.quantity).toBe(0.8904);

    const sec0 = result.lots.find(l => l.holdingRawTicker === 'SEC0 GY');
    expect(sec0?.quantity).toBe(52.4555);
  });

  it('parses real user Portu CSV exports correctly', async () => {
    const filePath = './sample_data/Portu_CZK_13361957.csv';
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(filePath)) return;

    const csvText = readFileSync(filePath, 'utf-8');
    const adapter = new PortuAdapter();
    const snapshot: FileSnapshot = {
      fileName: 'Portu_CZK_13361957.csv',
      fileExtension: '.csv',
      sizeBytes: csvText.length,
      data: csvText,
    };

    expect(await adapter.canHandle(snapshot)).toBe(true);
    const result = await adapter.parse(snapshot);

    expect(result.account.accountNumber).toBe('13361957');
    expect(result.holdings.length).toBe(6);
    expect(result.account.cashBalances.EUR).toBeCloseTo(121.65, 2);
  });
});
