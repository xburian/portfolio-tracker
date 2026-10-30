import React from 'react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { TrendingUp, TrendingDown, DollarSign, Globe, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const DailyChangeDeck: React.FC = () => {
  const getHoldingDailyChanges = usePortfolioStore((s) => s.getHoldingDailyChanges);
  const getCurrencyAttribution = usePortfolioStore((s) => s.getCurrencyAttribution);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const formatCurrency = useCurrencyStore((s) => s.formatCurrency);

  const dailyChanges = getHoldingDailyChanges();
  const attribution = getCurrencyAttribution();

  const totalDailyGainCZK = dailyChanges.reduce((sum, h) => sum + h.dailyGainCZK, 0);
  const totalPortfolioValueCZK = dailyChanges.reduce((sum, h) => sum + h.totalValueCZK, 0);
  const totalPrevValueCZK = totalPortfolioValueCZK - totalDailyGainCZK;
  const totalDailyPercent = totalPrevValueCZK > 0 ? (totalDailyGainCZK / totalPrevValueCZK) * 100 : 0;

  // Top gainers and losers
  const sortedHoldings = [...dailyChanges].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent);
  const topGainers = sortedHoldings.filter(h => h.dailyChangePercent > 0).slice(0, 3);
  const topLosers = sortedHoldings.filter(h => h.dailyChangePercent < 0).reverse().slice(0, 3);

  if (dailyChanges.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* 1. Celkový dnešní výsledek */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dnešní výsledek (24h)</span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            totalDailyGainCZK >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {totalDailyGainCZK >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {totalDailyGainCZK >= 0 ? '+' : ''}{totalDailyPercent.toFixed(2)} %
          </span>
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {totalDailyGainCZK >= 0 ? '+' : ''}{formatCurrency(totalDailyGainCZK, displayCurrency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pohyb tržní hodnoty od včerejšího uzavření trhu (Previous Close)
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span>Oceňovaných aktiv: <strong className="text-slate-200">{dailyChanges.length}</strong></span>
          <span>Zelených: <strong className="text-emerald-400">{sortedHoldings.filter(h => h.dailyGainCZK > 0).length}</strong> / Červených: <strong className="text-rose-400">{sortedHoldings.filter(h => h.dailyGainCZK < 0).length}</strong></span>
        </div>
      </div>

      {/* 2. Top pohyby dne (Gainers & Losers) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Největší denní pohyby</span>
          <span className="text-[11px] text-slate-500">Live Yahoo data</span>
        </div>

        <div className="space-y-2">
          {topGainers.slice(0, 2).map((h) => (
            <div key={h.holdingId} className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-slate-200">{h.normalizedTicker}</span>
                <span className="text-slate-400 text-[11px] truncate max-w-[100px]">{h.name}</span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-semibold">+{h.dailyChangePercent.toFixed(2)} %</span>
                <span className="text-slate-400 block text-[10px]">+{formatCurrency(h.dailyGainCZK, displayCurrency)}</span>
              </div>
            </div>
          ))}

          {topLosers.slice(0, 2).map((h) => (
            <div key={h.holdingId} className="flex items-center justify-between p-2 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold text-slate-200">{h.normalizedTicker}</span>
                <span className="text-slate-400 text-[11px] truncate max-w-[100px]">{h.name}</span>
              </div>
              <div className="text-right">
                <span className="text-rose-400 font-semibold">{h.dailyChangePercent.toFixed(2)} %</span>
                <span className="text-slate-400 block text-[10px]">{formatCurrency(h.dailyGainCZK, displayCurrency)}</span>
              </div>
            </div>
          ))}

          {topGainers.length === 0 && topLosers.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-4">Žádné cenové pohyby k dispozici</div>
          )}
        </div>
      </div>

      {/* 3. Měnová atribuce & Koše měn */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            Měnová atribuce zisku
          </span>
          <span className="text-[11px] text-indigo-400 font-medium">Akcie vs Kurz</span>
        </div>

        <div className="space-y-2.5">
          {attribution.map((b) => (
            <div key={b.currency} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">{b.currency} Koš ({b.weightPercent} %)</span>
                <span className={`font-semibold ${b.totalGainCZK >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {b.totalGainCZK >= 0 ? '+' : ''}{formatCurrency(b.totalGainCZK, displayCurrency)} ({b.totalGainPercent >= 0 ? '+' : ''}{b.totalGainPercent.toFixed(1)} %)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>Růst akcie: <strong className={b.pureAssetGainCZK >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{b.pureAssetGainCZK >= 0 ? '+' : ''}{formatCurrency(b.pureAssetGainCZK, displayCurrency)}</strong></span>
                {b.currency !== 'CZK' && (
                  <>
                    <span>•</span>
                    <span>Vliv FX: <strong className={b.pureFxGainCZK >= 0 ? 'text-indigo-400' : 'text-amber-400'}>{b.pureFxGainCZK >= 0 ? '+' : ''}{formatCurrency(b.pureFxGainCZK, displayCurrency)}</strong></span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
