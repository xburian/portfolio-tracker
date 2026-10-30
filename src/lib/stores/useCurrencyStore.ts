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
      formatCurrency: (amount, currency) => {
        const cur = currency || get().displayCurrency;
        const sym = cur === 'CZK' ? 'Kč' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur;
        const val = Math.round(amount).toLocaleString('cs-CZ');
        return `${val} ${sym}`;
      },
    }),
    { name: 'fintech-currency-settings' }
  )
);
