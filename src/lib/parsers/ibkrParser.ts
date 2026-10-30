import * as XLSX from 'xlsx';
import { BrokerId, CurrencyCode, AssetClass } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';

export class IbkrAdapter implements IBrokerAdapter {
  readonly id: BrokerId = 'IBKR';
  readonly displayName = 'Interactive Brokers';
  readonly supportedExtensions = ['.csv', '.xlsx', '.xls'];

  async canHandle(file: FileSnapshot): Promise<boolean> {
    const ext = file.fileExtension.toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const buffer = file.data instanceof ArrayBuffer 
          ? new Uint8Array(file.data)
          : file.data;
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const text = wb.SheetNames.join(' ').toLowerCase();
        return text.includes('ibkr') || text.includes('statement') || text.includes('position');
      } catch {
        return false;
      }
    }

    const text = typeof file.data === 'string' 
      ? file.data 
      : new TextDecoder().decode(file.data);
    const lower = text.slice(0, 2000).toLowerCase();
    return (
      lower.includes('interactive brokers') ||
      lower.includes('open positions,header') ||
      lower.includes('financial instrument information') ||
      lower.includes('positions and mark-to-market') ||
      lower.includes('mtm summary')
    );
  }

  async parse(file: FileSnapshot): Promise<IngestionResult> {
    const ext = file.fileExtension.toLowerCase();
    let lines: string[] = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const buffer = file.data instanceof ArrayBuffer 
        ? new Uint8Array(file.data)
        : file.data;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      lines = rawRows.map(row => (row || []).map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    } else {
      const text = typeof file.data === 'string' 
        ? file.data 
        : new TextDecoder().decode(file.data);
      lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }

    let accountNumber = 'IBKR-Account';
    let baseCurrency: CurrencyCode = 'USD';
    let cashBalance = 0;
    const holdings: IngestionResult['holdings'] = [];
    const lots: IngestionResult['lots'] = [];

    let openPosHeader: string[] = [];
    let mtmHeader: string[] = [];

    for (let r = 0; r < lines.length; r++) {
      const parts = splitCsv(lines[r]);
      if (parts.length < 2) continue;

      const section = parts[0]?.trim();
      const rowType = parts[1]?.trim();

      // Account info
      if (section === 'Account Information' && rowType === 'Data') {
        const fieldName = (parts[2] || '').trim().toLowerCase();
        const fieldVal = (parts[3] || '').trim();
        if (fieldName === 'account' && fieldVal) {
          accountNumber = fieldVal;
        }
        if (fieldName === 'base currency' && fieldVal) {
          baseCurrency = fieldVal.toUpperCase() as CurrencyCode;
        }
      }

      // Net Asset Value (Cash detection)
      if (section === 'Net Asset Value' && rowType === 'Data') {
        const assetClass = (parts[2] || '').trim().toLowerCase();
        if (assetClass === 'cash') {
          // In MTM Summary: column 6 is Current Total, column 5 is Current Long
          const val = parseNumber(parts[6] || parts[5] || parts[3]);
          if (val > 0) cashBalance = val;
        }
      }

      // 1. Format: Open Positions Header
      if (section === 'Open Positions' && rowType === 'Header') {
        openPosHeader = parts.map(p => p.toLowerCase());
      }

      // 1. Format: Open Positions Data row
      if (section === 'Open Positions' && rowType === 'Data' && openPosHeader.length > 0) {
        const col = {
          currency: openPosHeader.indexOf('currency'),
          symbol: openPosHeader.indexOf('symbol'),
          description: openPosHeader.indexOf('description'),
          secId: openPosHeader.indexOf('security id'),
          position: openPosHeader.indexOf('position'),
          costPrice: openPosHeader.indexOf('cost price'),
          markPrice: openPosHeader.indexOf('mark price'),
          value: openPosHeader.indexOf('value'),
        };

        const symbol = col.symbol !== -1 ? parts[col.symbol] : '';
        if (!symbol) continue;

        const currency = (col.currency !== -1 ? parts[col.currency] : baseCurrency).toUpperCase() as CurrencyCode;
        const description = col.description !== -1 ? parts[col.description] : symbol;
        const isin = col.secId !== -1 ? parts[col.secId] : undefined;
        const quantity = parseNumber(col.position !== -1 ? parts[col.position] : '0');
        const costPrice = parseNumber(col.costPrice !== -1 ? parts[col.costPrice] : '0');
        const markPrice = parseNumber(col.markPrice !== -1 ? parts[col.markPrice] : '0');
        const value = parseNumber(col.value !== -1 ? parts[col.value] : '0');

        if (quantity === 0) continue;

        const assetClass = detectAssetClass(description, symbol);

        holdings.push({
          rawTicker: symbol,
          name: description,
          isin,
          assetClass,
          instrumentCurrency: currency,
          reportedCurrentPrice: markPrice > 0 ? markPrice : undefined,
          reportedValue: value > 0 ? value : undefined,
        });

        lots.push({
          ticketId: `ibkr-${symbol}-${r}`,
          holdingRawTicker: symbol,
          type: quantity < 0 ? 'SELL' : 'BUY',
          quantity: Math.abs(quantity),
          openPrice: costPrice > 0 ? costPrice : markPrice,
          openDateUtc: new Date().toISOString(),
          instrumentCurrency: currency,
          reportedCurrentPrice: markPrice > 0 ? markPrice : undefined,
        });
      }

      // 2. Format: MTM Summary Header
      if (section === 'Positions and Mark-to-Market Profit and Loss' && rowType === 'Header') {
        mtmHeader = parts.map(p => p.toLowerCase());
      }

      // 2. Format: MTM Summary Data row
      if (section === 'Positions and Mark-to-Market Profit and Loss' && rowType === 'Data') {
        const dataDisc = (parts[2] || '').trim();
        const assetClassStr = (parts[3] || '').trim();

        if (dataDisc === 'Summary' && (assetClassStr === 'Stocks' || assetClassStr === 'Equity')) {
          const currency = ((parts[4] || '').trim().toUpperCase() || baseCurrency) as CurrencyCode;
          const symbol = (parts[5] || '').trim();
          const description = (parts[6] || '').trim() || symbol;
          const quantity = parseNumber(parts[8]); // Quantity
          const priorPrice = parseNumber(parts[9]);
          const currentPrice = parseNumber(parts[10]); // Price
          const marketValue = parseNumber(parts[12]); // Market Value

          if (quantity <= 0 || !symbol) continue;

          const assetClass = detectAssetClass(description, symbol);

          holdings.push({
            rawTicker: symbol,
            name: description,
            assetClass,
            instrumentCurrency: currency,
            reportedCurrentPrice: currentPrice > 0 ? currentPrice : undefined,
            reportedValue: marketValue > 0 ? marketValue : undefined,
          });

          lots.push({
            ticketId: `ibkr-${symbol}-${r}`,
            holdingRawTicker: symbol,
            type: 'BUY',
            quantity,
            openPrice: priorPrice > 0 ? priorPrice : currentPrice,
            openDateUtc: new Date().toISOString(),
            instrumentCurrency: currency,
            reportedCurrentPrice: currentPrice > 0 ? currentPrice : undefined,
          });
        }
      }
    }

    const cashMap: Record<CurrencyCode, number> = { CZK: 0, EUR: 0, USD: 0, GBP: 0 };
    if (baseCurrency in cashMap) {
      cashMap[baseCurrency] = cashBalance;
    } else {
      cashMap.CZK = cashBalance;
    }

    return {
      account: {
        brokerId: 'IBKR',
        accountNumber,
        accountName: `IBKR ${baseCurrency} (${accountNumber})`,
        baseCurrency,
        cashBalances: cashMap,
      },
      holdings,
      lots,
      warnings: [],
    };
  }
}

function detectAssetClass(description: string, symbol: string): AssetClass {
  const text = `${description} ${symbol}`.toLowerCase();
  if (text.includes('gold') || text.includes('silver') || text.includes('egln') || text.includes('commodity')) {
    return 'COMMODITY';
  }
  if (/\b(etf|etc|ucits|vwra|cebz|msci|ftse|s&p|sp500|index)\b/i.test(text)) {
    return 'ETF';
  }
  return 'EQUITY';
}

function splitCsv(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[\s\xa0]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
