import { CurrencyCode, MarketQuote } from '@/types/portfolio';

export class MarketPriceService {
  // Suffix mapping for Yahoo Finance
  private static readonly SUFFIX_MAP: Record<string, string> = {
    '.UK': '.L',   // XTB London -> Yahoo LSE (e.g. VUAA.UK -> VUAA.L, IGLN.UK -> IGLN.L, EGLN.UK -> EGLN.L)
    '.CZ': '.PR',  // XTB Prague -> Yahoo Prague (e.g. MONET.CZ -> MONET.PR, CEZ1.CZ -> CEZ.PR)
    '.PL': '.WA',  // XTB Warsaw -> Yahoo Warsaw
    '.AT': '.VI',  // Vienna
    '.NL': '.AS',  // Amsterdam
    ' LN': '.L',   // Portu London LSE
    ' GY': '.DE',  // Portu Germany XETRA
  };

  // Known ISIN / Ticker overrides
  private static readonly TICKER_OVERRIDES: Record<string, string> = {
    'CEZ1.CZ': 'CEZ.PR',
    'MONET.CZ': 'MONET.PR',
    'KOMB.CZ': 'KOMB.PR',
    'RBAG.CZ': 'RBI.VI',
    'RBAG.PR': 'RBI.VI',
    'BRKB.US': 'BRK-B',
    'BFB.US': 'BF-B',
    'CSPX LN': 'CSPX.L',
    'CNDX LN': 'CNDX.L',
    'XMK9 GY': 'XMK9.DE',
    'SXR7 GY': 'SXR7.DE',
    'IS3N GY': 'IS3N.DE',
    'ZPRS GY': 'ZPRS.DE',
    'AMEA GY': 'AMEA.DE',
    'SEC0 GY': 'SEC0.DE',
    'ASML.NL': 'ASML.AS',
    'HEIJM.NL': 'HEIJM.AS',
    'ICHN.NL': 'ICHN.AS',
    'VWRA': 'VWRA.L',
    'EGLN': 'EGLN.L',
    'CEBZ': 'CEBZ.DE',
  };

  // Known ISIN to Yahoo ticker resolution
  private static readonly ISIN_MAP: Record<string, string> = {
    'IE00B4L5Y983': 'IWDA.AS',  // iShares Core MSCI World
    'IE00B3WJKG14': 'QDVE.DE',  // iShares S&P 500 Info Tech
    'IE00BMC38736': 'SMH.MI',   // VanEck Semiconductor
    'IE00B3XXRP09': 'VUSA.AS',  // Vanguard S&P 500 Dist
    'IE00B1FZSF77': 'IPRP.AS',  // iShares US Property Yield
    'IE00BK5BQT80': 'VWCE.DE',  // Vanguard FTSE All-World Acc
    'US0846707026': 'BRK-B',    // Berkshire Hathaway B
    'US5949181045': 'MSFT',     // Microsoft
    'US0378331005': 'AAPL',     // Apple
    'CZ0005112300': 'CEZ.PR',   // CEZ
    'IE00B4ND3602': 'IGLN.L',   // iShares Physical Gold
    'IE00B1XNHC34': 'INRG.DE',  // iShares Global Clean Energy
    'US2546871060': 'DIS',      // Disney
    'US9344231041': 'WBD',      // Warner Bros Discovery
    'US69608A1088': 'PLTR',     // Palantir
    'US83406F1021': 'SOFI',     // Sofi
    'DE000A0F5UF5': 'EXXT.DE',  // iShares Nasdaq 100
  };

  static resolveTickerFromIsin(isin?: string, exchange?: string, fallbackName?: string): string {
    if (isin && this.ISIN_MAP[isin]) {
      return this.ISIN_MAP[isin];
    }
    if (isin && isin.length > 5) {
      return isin;
    }
    return (fallbackName || 'UNKNOWN').replace(/[^A-Za-z0-9]/g, '_');
  }

  static normalizeTicker(rawTicker: string, isin?: string): string {
    const clean = rawTicker.trim().toUpperCase();

    if (this.TICKER_OVERRIDES[clean]) {
      return this.TICKER_OVERRIDES[clean];
    }

    // US Equities in XTB end with '.US' -> strip suffix (e.g. AAPL.US -> AAPL, GOOGL.US -> GOOGL)
    if (clean.endsWith('.US')) {
      return clean.replace('.US', '');
    }

    // Replace European broker suffixes
    for (const [brokerSuffix, yahooSuffix] of Object.entries(this.SUFFIX_MAP)) {
      if (clean.endsWith(brokerSuffix)) {
        return clean.replace(new RegExp(`${brokerSuffix.replace('.', '\\.')}$`), yahooSuffix);
      }
    }

    return clean;
  }

  static async fetchQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
    if (symbols.length === 0) return {};

    const normalizedMap = new Map<string, string>(); // normalized -> raw
    const normalizedSymbols = symbols.map(s => {
      const norm = this.normalizeTicker(s);
      normalizedMap.set(norm, s);
      return norm;
    });

    try {
      const uniqueSymbols = Array.from(new Set(normalizedSymbols));
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(uniqueSymbols.join(','))}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch quotes: HTTP ${res.status}`);
      }

      const json = await res.json();
      const rawResults: Record<string, MarketQuote> = {};

      if (json.quotes) {
        for (const [normSym, q] of Object.entries(json.quotes as Record<string, any>)) {
          if (q) {
            const rawSym = normalizedMap.get(normSym) || normSym;
            rawResults[rawSym] = {
              symbol: rawSym,
              price: q.price,
              currency: q.currency as CurrencyCode,
              previousClose: q.previousClose,
              change: q.change,
              changePercent: q.changePercent,
              marketState: q.marketState,
              timestamp: q.timestamp || Date.now(),
            };
          }
        }
      }

      return rawResults;
    } catch (err) {
      console.warn('API quote fetch failed, using fallback prices:', err);
      return {};
    }
  }
}
