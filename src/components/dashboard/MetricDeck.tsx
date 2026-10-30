import React from 'react';
import { DollarSign, TrendingUp, Wallet, Coins } from 'lucide-react';
import { PortfolioSummary, CurrencyCode } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DeltaBadge } from '@/components/common/DeltaBadge';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

interface MetricDeckProps {
  summary: PortfolioSummary;
  onOpenCashManager?: () => void;
}

export const MetricDeck: React.FC<MetricDeckProps> = ({ summary, onOpenCashManager }) => {
  const accounts = usePortfolioStore((s) => s.accounts);
  const selectedAccountFilter = usePortfolioStore((s) => s.selectedAccountFilter);

  let relevantAccounts = accounts;
  if (selectedAccountFilter) {
    relevantAccounts = accounts.filter(a => a.id === selectedAccountFilter);
  }

  // Calculate currency breakdown
  const currencyTotals: Record<CurrencyCode, number> = { CZK: 0, USD: 0, EUR: 0, GBP: 0 };
  for (const acc of relevantAccounts) {
    for (const [currStr, amt] of Object.entries(acc.cashBalances || {})) {
      const c = currStr as CurrencyCode;
      if (amt && amt > 0) {
        currencyTotals[c] = (currencyTotals[c] || 0) + amt;
      }
    }
  }

  const cashSharePercent = summary.totalNav > 0
    ? ((summary.totalCashValue / summary.totalNav) * 100).toFixed(1)
    : '0';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Celková hodnota portfolia */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-slate-400">Hodnota portfolia (NAV)</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MoneyDisplay
            amount={summary.totalNav}
            className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight"
          />
          <div className="flex items-center gap-2 mt-2">
            <DeltaBadge valuePercent={summary.totalUnrealizedProfitPercent} />
            <span className="text-[11px] text-slate-500">celkový výnos</span>
          </div>
        </div>
      </div>

      {/* 2. Čistý zisk / All-time PnL */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-slate-400">Celkový zisk (P&L)</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MoneyDisplay
            amount={summary.totalUnrealizedProfit}
            showSign
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              summary.totalUnrealizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          />
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
            <span>Aktivum:</span>
            <MoneyDisplay amount={summary.pureAssetGain} showSign className="font-semibold text-slate-300" />
            <span className="mx-0.5">•</span>
            <span>Měna:</span>
            <MoneyDisplay amount={summary.fxGain} showSign className="font-semibold text-slate-300" />
          </div>
        </div>
      </div>

      {/* 3. Vložený kapitál vs Zhodnocení */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-slate-400">Vložený kapitál</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <MoneyDisplay
            amount={summary.totalCostBasis}
            className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight"
          />
          <div className="mt-2.5">
            {/* Split bar: Cost basis vs Gain */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    summary.totalMarketValue > 0
                      ? (summary.totalCostBasis / summary.totalMarketValue) * 100
                      : 100
                  )}%`,
                }}
                className="bg-indigo-500 h-full"
              />
              <div
                style={{
                  width: `${Math.max(
                    0,
                    summary.totalMarketValue > 0
                      ? (summary.totalUnrealizedProfit / summary.totalMarketValue) * 100
                      : 0
                  )}%`,
                }}
                className="bg-emerald-400 h-full"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>Vklad: {Math.round(summary.totalMarketValue > 0 ? (summary.totalCostBasis / summary.totalMarketValue) * 100 : 100)}%</span>
              <span>Zisk: {Math.round(summary.totalMarketValue > 0 ? (summary.totalUnrealizedProfit / summary.totalMarketValue) * 100 : 0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Volná hotovost & Efektivní diverzifikace */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Volná hotovost</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-amber-400 font-mono font-medium">
                {cashSharePercent} % z portfolia
              </span>
            </div>
          </div>
          <button
            onClick={onOpenCashManager}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            title="Spravovat a upravit zůstatky hotovosti na účtech (CZK, USD, EUR)"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Upravit</span>
          </button>
        </div>
        <div className="mt-3">
          <MoneyDisplay
            amount={summary.totalCashValue}
            className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight"
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-2 font-mono text-[10px]">
            {currencyTotals.CZK > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                {currencyTotals.CZK.toLocaleString('cs-CZ')} Kč
              </span>
            )}
            {currencyTotals.USD > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                ${currencyTotals.USD.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </span>
            )}
            {currencyTotals.EUR > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {currencyTotals.EUR.toLocaleString('de-DE', { minimumFractionDigits: 0 })} €
              </span>
            )}
            {summary.totalCashValue === 0 && (
              <span className="text-slate-500 italic">Klikněte na Upravit pro zadání hotovosti</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
