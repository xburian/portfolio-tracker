import * as XLSX from 'xlsx';
import { AssetClass, BrokerId, CurrencyCode } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';
import { MarketPriceService } from '@/lib/services/marketPriceService';

export class DegiroAdapter implements IBrokerAdapter {
  readonly id: BrokerId = 'DEGIRO';
  readonly displayName = 'Degiro';
  readonly supportedExtensions = ['.csv', '.xlsx', '.xls'];

  async canHandle(file: FileSnapshot): Promise<boolean> {
    const ext = file.fileExtension.toLowerCase();

    // Excel workbook handling
    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const buffer = file.data instanceof ArrayBuffer 
          ? new Uint8Array(file.data)
          : file.data;
        const wb = XLSX.read(buffer, { type: 'buffer' });
        
        // 1. Check if any sheet is named 'Transactions' or 'Transakce'
        const hasTxSheet = wb.SheetNames.some(n => {
          const l = n.toLowerCase();
          return l.includes('transaction') || l.includes('transakce');
        });
        if (hasTxSheet) return true;

        // 2. Check first sheet headers
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) return false;
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        if (rows.length === 0) return false;
        const headers = Array.from(rows[0] || []).map(h => String(h || '').trim().toLowerCase());
        const hasProduct = headers.some(h => h.includes('product') || h.includes('produkt'));
        const hasIsin = headers.some(h => h.includes('isin'));
        const hasVenueOrExchange = headers.some(h => h.includes('reference exchange') || h.includes('venue') || h.includes('beurs'));
        return hasProduct && hasIsin && hasVenueOrExchange;
      } catch {
        return false;
      }
    }

    // CSV text handling
    try {
      const text = typeof file.data === 'string' 
        ? file.data 
        : new TextDecoder().decode(file.data);
      const lower = text.slice(0, 2000).toLowerCase();
      return (
        (lower.includes('date') && lower.includes('product') && lower.includes('isin')) ||
        (lower.includes('datum') && lower.includes('product') && lower.includes('isin')) ||
        (lower.includes('reference exchange') && lower.includes('quantity')) ||
        (lower.includes('aantal') && lower.includes('koers'))
      );
    } catch {
      return false;
    }
  }

  async parse(file: FileSnapshot): Promise<IngestionResult> {
    const ext = file.fileExtension.toLowerCase();
    let rows: any[][];

    if (ext === '.xlsx' || ext === '.xls') {
      const buffer = file.data instanceof ArrayBuffer 
        ? new Uint8Array(file.data)
        : file.data;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const txSheetName = wb.SheetNames.find(n => {
        const l = n.toLowerCase();
        return l.includes('transaction') || l.includes('transakce');
      }) || wb.SheetNames[0];
      const sheet = wb.Sheets[txSheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    } else {
      // CSV: line-by-line parsing to avoid SheetJS auto-parsing serial dates/numbers
      const text = typeof file.data === 'string' 
        ? file.data 
        : new TextDecoder().decode(file.data);
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        throw new Error('Degiro CSV soubor je prázdný.');
      }
      const delimiter = lines[0].includes(';') ? ';' : ',';
      rows = lines.map(line => splitCsvLine(line, delimiter));
    }

    if (rows.length < 2) {
      throw new Error('Degiro soubor neobsahuje žádné platné transakce.');
    }

    const rawHeaders = Array.from(rows[0] || []);
    const headers = rawHeaders.map(h => String(h || '').trim().toLowerCase());

    const col = {
      date: headers.findIndex(h => h.includes('date') || h.includes('datum')),
      time: headers.findIndex(h => h.includes('time') || h.includes('tijd')),
      product: headers.findIndex(h => h.includes('product') || h.includes('produkt')),
      isin: headers.findIndex(h => h.includes('isin')),
      refExchange: headers.findIndex(h => h.includes('reference exchange') || h.includes('beurs')),
      venue: headers.findIndex(h => h.includes('venue')),
      quantity: headers.findIndex(h => h.includes('quantity') || h.includes('aantal')),
      price: headers.findIndex(h => h.startsWith('price') || h.startsWith('koers')),
      priceCurrency: -1,
      localValue: headers.findIndex(h => h.includes('local value') || h.includes('lokale waarde')),
      valueEur: headers.findIndex(h => h.includes('value eur') || h.includes('waarde eur') || h === 'value'),
      orderId: headers.findIndex(h => h.includes('order id') || h.includes('orderid') || h.includes('id')),
    };

    if (col.price !== -1 && col.price + 1 < headers.length) {
      col.priceCurrency = col.price + 1;
    }

    interface RawTx {
      dateStr: string;
      timeStr: string;
      product: string;
      isin: string;
      refExchange: string;
      quantity: number;
      price: number;
      currency: CurrencyCode;
      orderId: string;
      timestamp: number;
    }

    const transactions: RawTx[] = [];

    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i];
      if (!parts || parts.length < 3) continue;

      const isin = col.isin !== -1 ? String(parts[col.isin] || '').trim() : '';
      const product = col.product !== -1 ? String(parts[col.product] || '').trim() : 'Unknown';
      if (!isin && !product) continue;

      const qty = parseNumber(parts[col.quantity]);
      const price = parseNumber(parts[col.price]);
      const dateCell = col.date !== -1 ? parts[col.date] : '';
      const timeStr = col.time !== -1 ? String(parts[col.time] || '00:00').trim() : '00:00';
      const refExchange = col.refExchange !== -1 ? String(parts[col.refExchange] || '').trim() : '';
      const orderId = col.orderId !== -1 && parts[col.orderId] ? String(parts[col.orderId]).trim() : `degiro-${i}`;

      let currency: CurrencyCode = 'EUR';
      if (col.priceCurrency !== -1 && parts[col.priceCurrency]) {
        currency = detectCurrency(String(parts[col.priceCurrency]), 'EUR');
      }

      const { isoDate, timestamp } = parseDateCell(dateCell, timeStr);

      transactions.push({
        dateStr: isoDate,
        timeStr,
        product,
        isin,
        refExchange,
        quantity: qty,
        price,
        currency,
        orderId,
        timestamp,
      });
    }

    // Sort chronologically from oldest to newest for accurate FIFO lot accounting
    transactions.sort((a, b) => a.timestamp - b.timestamp);

    // FIFO Position Lot tracker per ISIN
    interface Lot {
      ticketId: string;
      quantity: number;
      openPrice: number;
      openDateUtc: string;
      currency: CurrencyCode;
    }

    interface PositionTracker {
      isin: string;
      product: string;
      refExchange: string;
      currency: CurrencyCode;
      openLots: Lot[];
    }

    const trackerMap = new Map<string, PositionTracker>();

    for (const tx of transactions) {
      const key = tx.isin || tx.product;
      if (!trackerMap.has(key)) {
        trackerMap.set(key, {
          isin: tx.isin,
          product: tx.product,
          refExchange: tx.refExchange,
          currency: tx.currency,
          openLots: [],
        });
      }

      const tracker = trackerMap.get(key)!;

      if (tx.quantity > 0) {
        // BUY: add new lot
        tracker.openLots.push({
          ticketId: tx.orderId,
          quantity: tx.quantity,
          openPrice: tx.price,
          openDateUtc: tx.dateStr,
          currency: tx.currency,
        });
      } else if (tx.quantity < 0) {
        // SELL: deplete open lots using FIFO
        let toSell = Math.abs(tx.quantity);
        while (toSell > 0 && tracker.openLots.length > 0) {
          const oldest = tracker.openLots[0];
          if (oldest.quantity <= toSell) {
            toSell -= oldest.quantity;
            tracker.openLots.shift(); // fully consumed
          } else {
            oldest.quantity -= toSell;
            toSell = 0; // partially consumed
          }
        }
      }
    }

    // Convert active open positions into IngestionResult
    const finalHoldings: IngestionResult['holdings'] = [];
    const finalLots: IngestionResult['lots'] = [];

    for (const tracker of trackerMap.values()) {
      const remainingQty = tracker.openLots.reduce((acc, l) => acc + l.quantity, 0);
      if (remainingQty <= 1e-6) {
        continue; // Position is completely closed (e.g. Disney, Sofi, Palantir, CEZ, Apple)
      }

      // Resolve normalized ticker
      const rawTicker = MarketPriceService.resolveTickerFromIsin(tracker.isin, tracker.refExchange, tracker.product);
      const assetClass: AssetClass = tracker.product.toLowerCase().includes('etf') || tracker.product.toLowerCase().includes('ucits')
        ? 'ETF'
        : tracker.product.toLowerCase().includes('gold')
        ? 'COMMODITY'
        : 'EQUITY';

      finalHoldings.push({
        rawTicker,
        name: tracker.product,
        isin: tracker.isin,
        assetClass,
        instrumentCurrency: tracker.currency,
      });

      for (const lot of tracker.openLots) {
        finalLots.push({
          ticketId: lot.ticketId,
          holdingRawTicker: rawTicker,
          type: 'BUY',
          quantity: lot.quantity,
          openPrice: lot.openPrice,
          openDateUtc: lot.openDateUtc,
          instrumentCurrency: lot.currency,
        });
      }
    }

    return {
      account: {
        brokerId: 'DEGIRO',
        accountNumber: 'Degiro-Main',
        accountName: 'Degiro EUR Účet',
        baseCurrency: 'EUR',
        cashBalances: { CZK: 0, EUR: 0, USD: 0, GBP: 0 },
      },
      holdings: finalHoldings,
      lots: finalLots,
      warnings: [],
    };
  }
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val);
  const clean = str.replace(/[\s\xa0]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function parseDateCell(val: any, timeStr: string): { isoDate: string; timestamp: number } {
  if (typeof val === 'number') {
    // Excel serial date code
    const ms = Math.round((val - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const iso = `${year}-${month}-${day}T${timeStr}:00Z`;
      return { isoDate: iso, timestamp: new Date(iso).getTime() };
    }
  }

  const dateStr = String(val || '').trim();
  const iso = parseDegiroDate(dateStr, timeStr);
  return { isoDate: iso, timestamp: new Date(iso).getTime() };
}

function parseDegiroDate(dateStr: string, timeStr: string): string {
  // Degiro formats: DD-MM-YYYY or YYYY-MM-DD
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T${timeStr}:00Z`;
    } else {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${timeStr}:00Z`;
    }
  }
  return new Date().toISOString();
}

function detectCurrency(text: string, fallback: CurrencyCode): CurrencyCode {
  const upper = text.toUpperCase();
  if (upper.includes('USD') || upper.includes('$')) return 'USD';
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  if (upper.includes('CZK') || upper.includes('KČ')) return 'CZK';
  if (upper.includes('GBP') || upper.includes('£')) return 'GBP';
  return fallback;
}
