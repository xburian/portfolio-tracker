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
    }),
    { name: 'fintech-currency-settings' }
  )
);
