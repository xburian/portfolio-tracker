import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CurrencyCode } from '@/types/portfolio';
import { CurrencyService } from '@/lib/services/currencyService';

interface CurrencyState {
  displayCurrency: CurrencyCode;
  rates: Record<string, number>;
  setDisplayCurrency: (curr: CurrencyCode) => void;
  updateRates: () => Promise<void>;
  convert: (amount: number, from: CurrencyCode, to?: CurrencyCode) => number;
  formatCurrency: (amount: number, currency?: CurrencyCode) => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      displayCurrency: 'CZK',
      rates: {
        EUR: 1.0,
        CZK: 25.25,
        USD: 1.085,
        GBP: 0.855,
      },
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      updateRates: async () => {
        const rates = await CurrencyService.initRates();
        set({ rates });
      },
      convert: (amount, from, to) => {
        const target = to || get().displayCurrency;
        return CurrencyService.convert(amount, from, target);
      },
      formatCurrency: (amountCZK, targetCurrency) => {
        const cur = targetCurrency || get().displayCurrency;
        const converted = CurrencyService.convert(amountCZK, 'CZK', cur);
        const config: Record<CurrencyCode, { locale: string; currency: string }> = {
          CZK: { locale: 'cs-CZ', currency: 'CZK' },
          EUR: { locale: 'de-DE', currency: 'EUR' },
          USD: { locale: 'en-US', currency: 'USD' },
          GBP: { locale: 'en-GB', currency: 'GBP' },
        };
        const c = config[cur] || config.CZK;
        const absVal = Math.abs(converted);
        const digits = absVal < 100 && cur !== 'CZK' ? 2 : 0;
        return new Intl.NumberFormat(c.locale, {
          style: 'currency',
          currency: c.currency,
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(converted);
      },
    }),
    { name: 'fintech-currency-settings' }
  )
);
