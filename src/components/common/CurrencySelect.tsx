import React from 'react';
import { CurrencyCode } from '@/types/portfolio';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

export const CurrencySelect: React.FC = () => {
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency);

  const currencies: CurrencyCode[] = ['CZK', 'EUR', 'USD'];

  return (
    <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-medium shadow-inner">
      {currencies.map((curr) => {
        const isActive = displayCurrency === curr;
        return (
          <button
            key={curr}
            onClick={() => setDisplayCurrency(curr)}
            className={`px-2.5 py-1 rounded-lg transition-all duration-150 ${
              isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {curr}
          </button>
        );
      })}
    </div>
  );
};
