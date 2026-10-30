import React from 'react';
import { CurrencyCode } from '@/types/portfolio';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';

interface MoneyDisplayProps {
  amount: number;
  currency?: CurrencyCode;
  className?: string;
  showSign?: boolean;
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  currency,
  className = '',
  showSign = false,
}) => {
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const privacyMode = usePreferencesStore((s) => s.privacyMode);

  const activeCurrency = currency || displayCurrency;
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  const formatConfig: Record<CurrencyCode, { locale: string; currency: string }> = {
    CZK: { locale: 'cs-CZ', currency: 'CZK' },
    EUR: { locale: 'de-DE', currency: 'EUR' },
    USD: { locale: 'en-US', currency: 'USD' },
    GBP: { locale: 'en-GB', currency: 'GBP' },
  };

  const config = formatConfig[activeCurrency] || formatConfig.CZK;
  const formatted = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safeAmount));

  const sign = showSign ? (safeAmount > 0 ? '+' : safeAmount < 0 ? '-' : '') : (safeAmount < 0 ? '-' : '');

  if (privacyMode) {
    const symbol = activeCurrency === 'CZK' ? 'Kč' : activeCurrency === 'EUR' ? '€' : '$';
    return (
      <span className={`font-mono text-slate-400 select-none tracking-wider ${className}`}>
        {sign}•••••• {symbol}
      </span>
    );
  }

  return (
    <span className={`font-mono whitespace-nowrap tracking-tight ${className}`}>
      {sign ? `${sign} ` : ''}{formatted}
    </span>
  );
};
