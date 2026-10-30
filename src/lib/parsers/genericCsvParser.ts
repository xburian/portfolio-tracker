import { BrokerId, CurrencyCode } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';

export class GenericCsvAdapter implements IBrokerAdapter {
  readonly id: BrokerId = 'GENERIC_CSV';
  readonly displayName = 'Generic CSV';
  readonly supportedExtensions = ['.csv'];

  async canHandle(file: FileSnapshot): Promise<boolean> {
    return file.fileExtension.toLowerCase() === '.csv';
  }

  async parse(file: FileSnapshot): Promise<IngestionResult> {
    const text = typeof file.data === 'string' 
      ? file.data 
      : new TextDecoder().decode(file.data);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV file is empty.');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

    const col = {
      symbol: headers.findIndex(h => h.includes('ticker') || h.includes('symbol')),
      name: headers.findIndex(h => h.includes('name') || h.includes('instrument') || h.includes('product')),
      quantity: headers.findIndex(h => h.includes('shares') || h.includes('quantity') || h.includes('volume') || h.includes('amount') || h.includes('počet')),
      price: headers.findIndex(h => h.includes('price') || h.includes('open price') || h.includes('cena')),
      currency: headers.findIndex(h => h.includes('currency') || h.includes('curr') || h.includes('měna')),
    };

    const holdings: IngestionResult['holdings'] = [];
    const lots: IngestionResult['lots'] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const symbol = (col.symbol !== -1 ? parts[col.symbol] : parts[0]) || `ITEM-${i}`;
      const name = col.name !== -1 ? parts[col.name] : symbol;
      const quantity = parseNumber(col.quantity !== -1 ? parts[col.quantity] : '1');
      const price = parseNumber(col.price !== -1 ? parts[col.price] : '0');
      const currency = ((col.currency !== -1 ? parts[col.currency] : 'USD') || 'USD').toUpperCase() as CurrencyCode;

      if (quantity === 0) continue;

      holdings.push({
        rawTicker: symbol,
        name,
        assetClass: 'EQUITY',
        instrumentCurrency: currency,
      });

      lots.push({
        ticketId: `gen-${symbol}-${i}`,
        holdingRawTicker: symbol,
        type: quantity < 0 ? 'SELL' : 'BUY',
        quantity: Math.abs(quantity),
        openPrice: price,
        openDateUtc: new Date().toISOString(),
        instrumentCurrency: currency,
      });
    }

    return {
      account: {
        brokerId: 'GENERIC_CSV',
        accountNumber: 'CSV-Import',
        accountName: 'CSV Portfolio',
        baseCurrency: 'USD',
        cashBalances: { CZK: 0, EUR: 0, USD: 0, GBP: 0 },
      },
      holdings,
      lots,
      warnings: [],
    };
  }
}

function parseNumber(val: string): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[\s\xa0]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
