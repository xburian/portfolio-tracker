import { CurrencyCode } from '@/types/portfolio';
import { db } from '@/lib/db';

export class CurrencyService {
  private static ratesCache: Record<string, number> = {
    EUR: 1.0,
    CZK: 25.25,
    USD: 1.085,
    GBP: 0.855,
  };
  private static lastFetched = 0;
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  static async initRates(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this.lastFetched && now - this.lastFetched < this.TTL_MS) {
      return this.ratesCache;
    }

    try {
      const res = await fetch('/api/fx');
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          this.ratesCache = { ...data.rates, EUR: 1.0 };
          this.lastFetched = now;

          // Store in Dexie
          for (const [curr, r] of Object.entries(this.ratesCache)) {
            await db.exchangeRates.put({
              pair: `EUR_${curr}`,
              rate: r,
              timestamp: now,
            });
          }
        }
      }
    } catch (e) {
      console.warn('CurrencyService: FX fetch failed, falling back to cached/default rates', e);
      // Try reading from Dexie
      try {
        const stored = await db.exchangeRates.toArray();
        if (stored.length > 0) {
          stored.forEach(s => {
            const curr = s.pair.replace('EUR_', '');
            this.ratesCache[curr] = s.rate;
          });
        }
      } catch {}
    }

    return this.ratesCache;
  }

  static getRate(from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return 1.0;
    const rateFromEur = from === 'EUR' ? 1.0 : this.ratesCache[from] || 1.0;
    const rateToEur = to === 'EUR' ? 1.0 : this.ratesCache[to] || 1.0;

    if (rateFromEur <= 0) return 1.0;
    return rateToEur / rateFromEur;
  }

  static convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amount;
    const rate = this.getRate(from, to);
    return amount * rate;
  }

  static getRatesTo(targetCurrency: CurrencyCode = 'CZK'): Record<CurrencyCode, number> {
    const currencies: CurrencyCode[] = ['CZK', 'EUR', 'USD', 'GBP'];
    const result: Partial<Record<CurrencyCode, number>> = {};
    for (const c of currencies) {
      result[c] = this.getRate(c, targetCurrency);
    }
    return result as Record<CurrencyCode, number>;
  }

  static getRatesToCZK(): Record<CurrencyCode, number> {
    return this.getRatesTo('CZK');
  }
}
