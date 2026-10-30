import * as XLSX from 'xlsx';
import { BrokerId, CurrencyCode } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';

export class PortuAdapter implements IBrokerAdapter {
  readonly id: BrokerId = 'PORTU';
  readonly displayName = 'Portu';
  readonly supportedExtensions = ['.csv', '.xlsx', '.xls', '.pdf'];

  async canHandle(file: FileSnapshot): Promise<boolean> {
    const ext = file.fileExtension.toLowerCase();
    const name = file.fileName.toLowerCase();

    if (ext === '.pdf') {
      return name.includes('portu') || name.includes('dip');
    }

    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const buffer = file.data instanceof ArrayBuffer 
          ? new Uint8Array(file.data)
          : file.data;
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) return false;
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        if (rows.length === 0) return false;
        const headers = Array.from(rows[0] || []).map(h => String(h || '').trim().toLowerCase());
        const hasInstrument = headers.some(h => h.includes('instrument') || h.includes('název'));
        const hasQty = headers.some(h => h.includes('počet kusů') || h.includes('kusy') || h.includes('ks'));
        const hasPrice = headers.some(h => h.includes('nákupní cena') || h.includes('aktuální cena'));
        return (hasInstrument && (hasQty || hasPrice)) || name.includes('portu');
      } catch {
        return false;
      }
    }

    try {
      const text = typeof file.data === 'string' 
        ? file.data 
        : new TextDecoder().decode(file.data);
      const lower = text.slice(0, 1500).toLowerCase();
      return (
        name.includes('portu') ||
        (lower.includes('instrument') && lower.includes('počet kusů') && lower.includes('nákupní cena')) ||
        (lower.includes('portu') && lower.includes('isin')) ||
        (lower.includes('nerealizovaný zisk v czk') || lower.includes('aktuální hodnota v czk')) ||
        lower.includes('ii. zůstatky')
      );
    } catch {
      return false;
    }
  }

  async parse(file: FileSnapshot): Promise<IngestionResult> {
    const ext = file.fileExtension.toLowerCase();

    if (ext === '.pdf') {
      return await this.parsePdf(file);
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const buffer = file.data instanceof ArrayBuffer 
        ? new Uint8Array(file.data)
        : file.data;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      return this.parseGrid(rows, file.fileName);
    }

    // CSV text
    const text = typeof file.data === 'string' 
      ? file.data 
      : new TextDecoder().decode(file.data);

    if (text.includes('II. Zůstatky') || text.includes('I. Přehled účtu')) {
      return this.parsePdfText(text, file.fileName);
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('Portu soubor je prázdný.');
    }
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
    return this.parseGrid(rows, file.fileName);
  }

  private async parsePdf(file: FileSnapshot): Promise<IngestionResult> {
    let pdfText = '';

    // Check if running in Node/Bun environment
    if (typeof process !== 'undefined' && (process.versions?.bun || process.versions?.node)) {
      try {
        const { PDFParse } = await import('pdf-parse');
        const buffer = file.data instanceof ArrayBuffer 
          ? new Uint8Array(file.data)
          : file.data;
        const parser = new PDFParse({ data: buffer });
        const res = await parser.getText();
        pdfText = res.text;
      } catch (err: any) {
        console.warn('Local pdf-parse failed, falling back to server API', err);
      }
    }

    // In browser or fallback: use server endpoint /api/parse-pdf
    if (!pdfText) {
      let base64 = '';
      if (typeof file.data === 'string') {
        base64 = btoa(file.data);
      } else {
        const bytes = new Uint8Array(file.data as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
      }

      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.fileName }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Nepodařilo se extrahovat text z PDF výpisu ${file.fileName}`);
      }

      const json = await res.json();
      pdfText = json.text;
    }

    if (!pdfText) {
      throw new Error(`PDF výpis ${file.fileName} neobsahuje čitelný text.`);
    }

    return this.parsePdfText(pdfText, file.fileName);
  }

  public parsePdfText(text: string, fileName: string): IngestionResult {
    let accountNumber = 'Portu-Main';
    let accountName = 'Portu Portfolio';
    let baseCurrency: CurrencyCode = 'CZK';

    // Account identification from Section I
    const section1Match = text.match(/Portfolio\s+(?:od\s+Portu|podle\s+vás)\s*\t\s*([^\t]+)\s*\t\s*(\d+)\s*\t\s*([A-Z]{3})/i);
    if (section1Match) {
      const rawName = section1Match[1].trim();
      accountName = `Portu ${rawName}`;
      accountNumber = section1Match[2].trim();
      baseCurrency = section1Match[3].trim().toUpperCase() as CurrencyCode;
    } else {
      const accMatch = fileName.match(/(\d{7,10})/);
      if (accMatch) accountNumber = accMatch[1];
      if (fileName.toLowerCase().includes('dip')) accountName = 'Portu DIP';
    }

    // Extract Section II: Zůstatky
    const sec2Idx = text.indexOf('II. Zůstatky');
    if (sec2Idx === -1) {
      throw new Error('Sekce II. Zůstatky nebyla nalezena ve výpisu Portu.');
    }
    const sec3Idx = text.indexOf('III. Provedené transakce', sec2Idx);
    const sec2Text = sec3Idx !== -1 ? text.slice(sec2Idx, sec3Idx) : text.slice(sec2Idx);

    const lines = sec2Text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const holdings: IngestionResult['holdings'] = [];
    const lots: IngestionResult['lots'] = [];
    const cashBalances: Record<CurrencyCode, number> = { CZK: 0, EUR: 0, USD: 0, GBP: 0 };

    let pendingSymbol: string | null = null;
    let pendingName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Cash balance detection (e.g. "EUR \t Hotovost \t EUR \t 121,65 \t 24,440000 \t 2 973,13")
      if (line.includes('Hotovost') || line.includes('hotovost')) {
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length >= 4) {
          const curr = (parts[2] || parts[0]).toUpperCase() as CurrencyCode;
          const amtStr = parts[3].replace(/[\s\xa0]/g, '').replace(',', '.');
          const amt = parseFloat(amtStr) || 0;
          cashBalances[curr] = (cashBalances[curr] || 0) + amt;
        }
        pendingSymbol = null;
        continue;
      }

      // Single line holding
      const singleLineMatch = line.match(/^([A-Z0-9]{3,6}\s+[A-Z]{2})\s*\t\s*([^\t]+)\s*\t\s*([A-Z]{3})\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)/i);
      if (singleLineMatch) {
        const symbol = singleLineMatch[1].trim();
        const name = singleLineMatch[2].trim();
        const curr = singleLineMatch[3].trim().toUpperCase() as CurrencyCode;
        const qty = parseFloat(singleLineMatch[4].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;
        const price = parseFloat(singleLineMatch[5].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;
        const val = parseFloat(singleLineMatch[6].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;

        if (qty > 0) {
          holdings.push({
            rawTicker: symbol,
            name,
            assetClass: 'ETF',
            instrumentCurrency: curr,
            reportedCurrentPrice: price,
            reportedValue: val,
          });
          lots.push({
            ticketId: `portu-${accountNumber}-${symbol}`,
            holdingRawTicker: symbol,
            type: 'BUY',
            quantity: qty,
            openPrice: price,
            openDateUtc: '2026-09-30T00:00:00.000Z',
            instrumentCurrency: curr,
          });
        }
        pendingSymbol = null;
        continue;
      }

      // Multi-line holding start (e.g. "XMK9 GY X-TRACKERS MSCI Japan EUR Hedged")
      const startMultiMatch = line.match(/^([A-Z0-9]{3,6}\s+[A-Z]{2})\s+(.*)$/i);
      if (startMultiMatch && !line.includes('\t')) {
        pendingSymbol = startMultiMatch[1].trim();
        pendingName = startMultiMatch[2].trim();
        continue;
      }

      // Multi-line holding continuation with tabs
      if (pendingSymbol) {
        const contMatch = line.match(/^(.*?)\s*([A-Z]{3})\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)\s*\t\s*([\d\s,.]+)/i);
        if (contMatch) {
          const extraName = contMatch[1].trim();
          const fullInstrumentName = (pendingName + ' ' + extraName).trim();
          const curr = contMatch[2].trim().toUpperCase() as CurrencyCode;
          const qty = parseFloat(contMatch[3].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;
          const price = parseFloat(contMatch[4].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;
          const val = parseFloat(contMatch[5].replace(/[\s\xa0]/g, '').replace(',', '.')) || 0;

          if (qty > 0) {
            holdings.push({
              rawTicker: pendingSymbol,
              name: fullInstrumentName,
              assetClass: 'ETF',
              instrumentCurrency: curr,
              reportedCurrentPrice: price,
              reportedValue: val,
            });
            lots.push({
              ticketId: `portu-${accountNumber}-${pendingSymbol}`,
              holdingRawTicker: pendingSymbol,
              type: 'BUY',
              quantity: qty,
              openPrice: price,
              openDateUtc: '2026-09-30T00:00:00.000Z',
              instrumentCurrency: curr,
            });
          }
          pendingSymbol = null;
          continue;
        }
      }
    }

    return {
      account: {
        brokerId: 'PORTU',
        accountNumber,
        accountName,
        baseCurrency,
        cashBalances,
      },
      holdings,
      lots,
      warnings: [],
    };
  }

  private parseGrid(rows: any[][], fileName: string): IngestionResult {
    let accountNumber = 'Portu-Main';
    let accountName = 'Portu Portfolio';
    const accMatch = fileName.match(/(\d{7,10})/);
    if (accMatch) accountNumber = accMatch[1];
    if (fileName.toLowerCase().includes('dip')) accountName = 'Portu DIP';
    else if (fileName.toLowerCase().includes('czk') || fileName.toLowerCase().includes('primary')) accountName = 'Portu Primary portfolio';

    const rawHeaders = Array.from(rows[0] || []);
    const headers = rawHeaders.map(h => String(h || '').trim().toLowerCase());

    const col = {
      symbol: headers.findIndex(h => h.includes('symbol') || h.includes('ticker')),
      instrument: headers.findIndex(h => h.includes('instrument') || h.includes('název')),
      isin: headers.findIndex(h => h.includes('isin')),
      currency: headers.findIndex(h => h.includes('měna') || h.includes('currency')),
      quantity: headers.findIndex(h => h.includes('počet kusů') || h.includes('kusy') || h.includes('ks')),
      buyPrice: headers.findIndex(h => h.includes('nákupní cena') || h.includes('cena')),
      curPrice: headers.findIndex(h => h.includes('aktuální cena')),
      valueCzk: headers.findIndex(h => h.includes('hodnota v czk') || h.includes('hodnota')),
    };

    const holdings: IngestionResult['holdings'] = [];
    const lots: IngestionResult['lots'] = [];
    const cashBalances: Record<CurrencyCode, number> = { CZK: 0, EUR: 0, USD: 0, GBP: 0 };

    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i];
      if (!parts || parts.length < 3) continue;

      const symbol = col.symbol !== -1 ? String(parts[col.symbol] || '').trim() : '';
      const instrumentName = col.instrument !== -1 ? String(parts[col.instrument] || '').trim() : symbol || 'Unknown';
      const isin = col.isin !== -1 ? String(parts[col.isin] || '').trim() : '';
      const currency = (col.currency !== -1 && parts[col.currency] 
        ? String(parts[col.currency]).trim().toUpperCase() 
        : 'CZK') as CurrencyCode;
      const quantity = parseNumber(parts[col.quantity]);
      const buyPrice = parseNumber(parts[col.buyPrice]);
      const curPrice = parseNumber(parts[col.curPrice]);
      const valueCzk = parseNumber(parts[col.valueCzk]);

      // If item is cash
      if (instrumentName.toLowerCase().includes('hotovost') || instrumentName.toLowerCase().includes('cash')) {
        const cashCurr = (currency || 'CZK') as CurrencyCode;
        const amt = cashCurr === 'CZK' ? (valueCzk || buyPrice || quantity) : (buyPrice || quantity || valueCzk);
        cashBalances[cashCurr] = (cashBalances[cashCurr] || 0) + amt;
        continue;
      }

      if (quantity <= 0) continue;

      const rawTicker = symbol || isin || instrumentName.split(/\s+/)[0].toUpperCase();

      holdings.push({
        rawTicker,
        name: instrumentName,
        isin,
        assetClass: instrumentName.toLowerCase().includes('etf') || rawTicker.includes('GY') || rawTicker.includes('LN') ? 'ETF' : 'EQUITY',
        instrumentCurrency: currency,
        reportedCurrentPrice: curPrice || buyPrice,
        reportedValue: valueCzk,
      });

      lots.push({
        ticketId: `portu-${accountNumber}-${rawTicker}`,
        holdingRawTicker: rawTicker,
        type: 'BUY',
        quantity,
        openPrice: buyPrice || curPrice,
        openDateUtc: '2026-09-30T00:00:00.000Z',
        instrumentCurrency: currency,
      });
    }

    return {
      account: {
        brokerId: 'PORTU',
        accountNumber,
        accountName,
        baseCurrency: 'CZK',
        cashBalances,
      },
      holdings,
      lots,
      warnings: [],
    };
  }
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val);
  const clean = str.replace(/[\s\xa0]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}
