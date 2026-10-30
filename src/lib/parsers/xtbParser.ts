import * as XLSX from 'xlsx';
import { AssetClass, BrokerId, CurrencyCode, CashLedgerTransaction } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';

export class XtbAdapter implements IBrokerAdapter {
  readonly id: BrokerId = 'XTB';
  readonly displayName = 'XTB (xStation)';
  readonly supportedExtensions = ['.xlsx', '.xls'];

  async canHandle(file: FileSnapshot): Promise<boolean> {
    try {
      const buffer = typeof file.data === 'string' 
        ? new TextEncoder().encode(file.data).buffer 
        : file.data;
      const wb = XLSX.read(buffer, { type: 'array', sheetRows: 25 });
      return wb.SheetNames.some(name => 
        name.toLowerCase().includes('open position') || 
        name.toLowerCase().includes('closed position') ||
        name.toLowerCase().includes('cash operation')
      );
    } catch {
      return false;
    }
  }

  async parse(file: FileSnapshot): Promise<IngestionResult> {
    const buffer = typeof file.data === 'string' 
      ? new TextEncoder().encode(file.data).buffer 
      : file.data;
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

    let accountNumber = 'XTB-Account';
    let accountCurrency: CurrencyCode = 'CZK';
    const cashBalances: Record<CurrencyCode, number> = { CZK: 0, EUR: 0, USD: 0, GBP: 0 };
    const warnings: string[] = [];

    // Find Open Positions sheet
    const openSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('open position'));
    if (!openSheetName) {
      throw new Error('XTB Statement is missing "Open Positions" sheet.');
    }

    const openSheet = wb.Sheets[openSheetName];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(openSheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

    // Step 1: Detect Metadata & Currency (Rows 1-10)
    for (let r = 0; r < Math.min(10, sheetData.length); r++) {
      const row = sheetData[r] || [];
      const rowStr = row.map(c => String(c ?? '')).join(' ');
      
      const accMatch = rowStr.match(/Account number[\s:]*([0-9]+)/i) || rowStr.match(/Account[\s:]*([0-9]+)/i);
      if (accMatch) {
        accountNumber = accMatch[1];
      }

      // Detect Account Currency from summary: "Open position value ... CZK/USD/EUR"
      const curMatch = rowStr.match(/Open position value.*?(CZK|USD|EUR|GBP)/i);
      if (curMatch) {
        accountCurrency = curMatch[1].toUpperCase() as CurrencyCode;
      }
    }

    // Step 2: Locate Header row (scan for "Ticker" and ("Volume" or "Instrument"))
    let headerIdx = -1;
    for (let r = 0; r < Math.min(25, sheetData.length); r++) {
      const row = (sheetData[r] || []).map(c => String(c ?? '').trim().toLowerCase());
      if (row.includes('ticker') && (row.includes('volume') || row.includes('category'))) {
        headerIdx = r;
        break;
      }
    }

    if (headerIdx === -1) {
      throw new Error('XTB Statement: Column headers not found in "Open Positions" sheet.');
    }

    const headers = (sheetData[headerIdx] || []).map(c => String(c ?? '').trim().toLowerCase());
    const col = {
      product: headers.indexOf('product'),
      instrument: headers.findIndex(h => h.includes('instrument') || h.includes('position')),
      ticker: headers.indexOf('ticker'),
      category: headers.indexOf('category'),
      type: headers.indexOf('type'),
      volume: headers.indexOf('volume'),
      value: headers.indexOf('value'),
      currentPrice: headers.findIndex(h => h.includes('current price')),
      openPrice: headers.findIndex(h => h.includes('open price')),
      openTime: headers.findIndex(h => h.includes('open time')),
      netProfit: headers.findIndex(h => h.includes('net profit')),
    };

    interface TempHolding {
      rawTicker: string;
      name: string;
      category: string;
      expectedVolume: number;
      reportedValue: number;
      reportedCurrentPrice?: number;
      lots: Array<{
        ticketId: string;
        type: 'BUY' | 'SELL';
        quantity: number;
        openPrice: number;
        openDateUtc: string;
        currentPrice?: number;
        netProfit?: number;
      }>;
    }

    const holdingsMap = new Map<string, TempHolding>();
    let currentHolding: TempHolding | null = null;

    for (let r = headerIdx + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row || row.every((c: any) => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      const rawProduct = String(row[col.product] ?? '').trim();
      const rawInstrument = String(row[col.instrument] ?? '').trim();
      const rawTicker = String(row[col.ticker] ?? '').trim();
      const rawCategory = String(row[col.category] ?? '').trim();
      const rawType = String(row[col.type] ?? '').trim().toUpperCase();

      const isTicketRow = rawType === 'BUY' || rawType === 'SELL' || /^[0-9]{6,}$/.test(rawInstrument);

      if (!isTicketRow) {
        // Summary row for an instrument
        const ticker = rawTicker || (rawInstrument.includes('.') ? rawInstrument : '');
        if (!ticker) continue;

        // In XTB, 'Instrument/Position' contains the human-readable name (e.g. 'Core S&P 500', 'Moneta', 'Erste')
        // while 'Product' is typically 'My Trades' or 'Investment Plans'
        const displayName = (rawInstrument && !rawInstrument.includes('.') && isNaN(Number(rawInstrument)))
          ? rawInstrument
          : (rawProduct && rawProduct !== 'My Trades' && rawProduct !== 'Investment Plans')
          ? rawProduct
          : rawInstrument || ticker;

        const volume = parseNumber(row[col.volume]);
        const value = parseNumber(row[col.value]);
        const curPrice = parseNumber(row[col.currentPrice]);

        const instrumentCurrency = inferInstrumentCurrency(ticker, accountCurrency);
        const impliedPrice = volume > 0 && value > 0 && instrumentCurrency === accountCurrency 
          ? value / volume 
          : undefined;

        currentHolding = {
          rawTicker: ticker,
          name: displayName,
          category: rawCategory,
          expectedVolume: volume,
          reportedValue: value,
          reportedCurrentPrice: curPrice > 0 ? curPrice : impliedPrice,
          lots: [],
        };
        holdingsMap.set(ticker, currentHolding);
      } else {
        // Individual Ticket Row
        const ticketId = rawInstrument || `xtb-${r}`;
        const ticker: string = rawTicker || (currentHolding ? currentHolding.rawTicker : 'UNKNOWN');
        const lotVol = parseNumber(row[col.volume]);
        const openPrice = parseNumber(row[col.openPrice]);
        const curPrice = parseNumber(row[col.currentPrice]);
        const netProfit = parseNumber(row[col.netProfit]);
        const openTime = parseDate(row[col.openTime]);

        if (!currentHolding || currentHolding.rawTicker !== ticker) {
          if (!holdingsMap.has(ticker)) {
            holdingsMap.set(ticker, {
              rawTicker: ticker,
              name: ticker,
              category: rawCategory || 'ETF',
              expectedVolume: lotVol,
              reportedValue: 0,
              reportedCurrentPrice: curPrice > 0 ? curPrice : undefined,
              lots: [],
            });
          }
          currentHolding = holdingsMap.get(ticker)!;
        }

        if (curPrice > 0 && !currentHolding.reportedCurrentPrice) {
          currentHolding.reportedCurrentPrice = curPrice;
        }

        currentHolding.lots.push({
          ticketId,
          type: rawType === 'SELL' ? 'SELL' : 'BUY',
          quantity: lotVol,
          openPrice,
          openDateUtc: openTime,
          currentPrice: curPrice > 0 ? curPrice : undefined,
          netProfit,
        });
      }
    }

    // Convert holdingsMap to final normalized output
    const finalHoldings: IngestionResult['holdings'] = [];
    const finalLots: IngestionResult['lots'] = [];

    for (const h of holdingsMap.values()) {
      const assetClass = mapCategory(h.category);
      const totalLotVol = h.lots.reduce((acc, l) => acc + l.quantity, 0);

      // Volume reconciliation check
      if (h.expectedVolume > 0 && Math.abs(totalLotVol - h.expectedVolume) > 1e-4) {
        warnings.push(`Instrument ${h.name} (${h.rawTicker}) volume mismatch: reported ${h.expectedVolume}, lot sum ${totalLotVol}`);
      }

      // If no individual lot rows existed, create a synthetic lot from summary row
      if (h.lots.length === 0 && h.expectedVolume > 0) {
        h.lots.push({
          ticketId: `synth-${h.rawTicker}`,
          type: 'BUY',
          quantity: h.expectedVolume,
          openPrice: 0,
          openDateUtc: new Date().toISOString(),
          currentPrice: h.reportedCurrentPrice,
        });
      }

      // Infer instrument currency from ticker suffix
      const instrumentCurrency = inferInstrumentCurrency(h.rawTicker, accountCurrency);

      finalHoldings.push({
        rawTicker: h.rawTicker,
        name: h.name,
        assetClass,
        instrumentCurrency,
        reportedCurrentPrice: h.reportedCurrentPrice,
        reportedValue: h.reportedValue,
      });

      for (const l of h.lots) {
        finalLots.push({
          ticketId: l.ticketId,
          holdingRawTicker: h.rawTicker,
          type: l.type,
          quantity: l.quantity,
          openPrice: l.openPrice,
          openDateUtc: l.openDateUtc,
          instrumentCurrency,
          reportedCurrentPrice: l.currentPrice,
          reportedNetProfit: l.netProfit,
        });
      }
    }

    // Parse Cash Operations if sheet exists
    const cashOps: IngestionResult['cashOperations'] = [];
    const cashSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('cash operation'));
    if (cashSheetName) {
      const cashSheet = wb.Sheets[cashSheetName];
      const cashData: any[][] = XLSX.utils.sheet_to_json(cashSheet, { header: 1, raw: false });
      
      let cashHeaderIdx = -1;
      for (let r = 0; r < Math.min(15, cashData.length); r++) {
        const row = (cashData[r] || []).map(c => String(c ?? '').trim().toLowerCase());
        if (row.includes('amount') || row.includes('type')) {
          cashHeaderIdx = r;
          break;
        }
      }

      if (cashHeaderIdx !== -1) {
        const headers = cashData[cashHeaderIdx].map(c => String(c ?? '').trim().toLowerCase());
        const cType = headers.indexOf('type');
        const cTime = headers.indexOf('time');
        const cAmount = headers.indexOf('amount');
        const cId = headers.indexOf('id');
        const cComment = headers.indexOf('comment');

        for (let r = cashHeaderIdx + 1; r < cashData.length; r++) {
          const row = cashData[r];
          if (!row || row.length === 0) continue;

          const typeStr = String(row[cType] ?? '').trim().toLowerCase();
          const amount = parseNumber(row[cAmount]);
          const time = parseDate(row[cTime]);
          const id = String(row[cId] ?? `cash-${r}`);
          const comment = String(row[cComment] ?? '');

          let opType: CashLedgerTransaction['type'] = 'OTHER';
          if (typeStr.includes('dividend')) opType = 'DIVIDEND';
          else if (typeStr.includes('tax') || typeStr.includes('wht')) opType = 'TAX';
          else if (typeStr.includes('interest')) opType = 'INTEREST';
          else if (typeStr.includes('transfer')) opType = 'TRANSFER';
          else if (typeStr.includes('deposit')) opType = 'DEPOSIT';
          else if (typeStr.includes('withdrawal')) opType = 'WITHDRAWAL';

          cashOps.push({
            id,
            accountId: `xtb-${accountNumber}`,
            type: opType,
            amount,
            currency: accountCurrency,
            timeUtc: time,
            comment,
          });
        }
      }
    }

    return {
      account: {
        brokerId: 'XTB',
        accountNumber,
        accountName: `XTB ${accountCurrency} (${accountNumber})`,
        baseCurrency: accountCurrency,
        cashBalances,
      },
      holdings: finalHoldings,
      lots: finalLots,
      cashOperations: cashOps,
      warnings,
    };
  }
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[\s\xa0]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapCategory(cat: string): AssetClass {
  const c = cat.toUpperCase();
  if (c.includes('ETF')) return 'ETF';
  if (c.includes('STOCK') || c.includes('STC')) return 'EQUITY';
  if (c.includes('ETC') || c.includes('GOLD') || c.includes('COMMODITY')) return 'COMMODITY';
  if (c.includes('CRYPTO')) return 'CRYPTO';
  if (c.includes('BOND')) return 'BOND';
  return 'EQUITY';
}

function inferInstrumentCurrency(ticker: string, fallback: CurrencyCode): CurrencyCode {
  const t = ticker.toUpperCase();
  if (t.endsWith('.US')) return 'USD';
  if (t.endsWith('.CZ') || t.endsWith('.PR')) return 'CZK';
  if (t.endsWith('.DE') || t.endsWith('.NL') || t.endsWith('.FR') || t.endsWith('.IT') || t.endsWith('.ES')) return 'EUR';
  if (t.endsWith('.UK') || t.endsWith('.L')) {
    // E.g. VUAA.UK or IGLN.UK can trade in USD on LSE, or EGLN in EUR/USD
    // We default to accountCurrency or USD
    return fallback === 'USD' ? 'USD' : fallback === 'EUR' ? 'EUR' : 'USD';
  }
  return fallback;
}
