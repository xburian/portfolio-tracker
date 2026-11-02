import React, { useState, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  Award,
  AlertTriangle,
  Flame,
  Percent,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { CurrencyCode, PositionLot, ValuationDetail, MonthReturnCell, MonthlyPerformanceMatrix } from '@/types/portfolio';
import { PerformanceService } from '@/lib/services/performanceService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

interface MonthlyReturnsMatrixProps {
  valuations: ValuationDetail[];
}

const CZECH_MONTHS_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export const MonthlyReturnsMatrix: React.FC<MonthlyReturnsMatrixProps> = ({ valuations }) => {
  const lots = usePortfolioStore((s) => s.lots);
  const dividends = usePortfolioStore((s) => s.dividends);
  const closedPositions = usePortfolioStore((s) => s.closedPositions);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const [hoveredCell, setHoveredCell] = useState<MonthReturnCell | null>(null);

  const matrix: MonthlyPerformanceMatrix = useMemo(() => {
    return PerformanceService.calculateMonthlyReturnsMatrix(
      valuations,
      lots,
      [],
      displayCurrency,
      dividends,
      closedPositions
    );
  }, [valuations, lots, displayCurrency, dividends, closedPositions]);

  const getCellBg = (ret: number) => {
    if (ret >= 4.0) return 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50 font-bold';
    if (ret > 0) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-medium';
    if (ret === 0) return 'bg-slate-800/40 text-slate-400 border-slate-700/40';
    if (ret > -3.0) return 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-medium';
    return 'bg-rose-500/30 text-rose-200 border-rose-500/50 font-bold';
  };

  const getYtdBg = (ret: number) => {
    if (ret >= 10.0) return 'bg-indigo-500/25 text-emerald-300 border-indigo-500/40 font-bold';
    if (ret > 0) return 'bg-indigo-500/15 text-emerald-300 border-indigo-500/30 font-semibold';
    if (ret === 0) return 'bg-slate-800/60 text-slate-400 border-slate-700/50';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Best Month */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Nejlepší měsíc</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-emerald-400">
              {matrix.bestMonth ? `+${matrix.bestMonth.returnPercent.toFixed(1)} %` : '—'}
            </span>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {matrix.bestMonth ? `${matrix.bestMonth.monthLabel} ${matrix.bestMonth.year}` : 'Žádná data'}
            </p>
          </div>
        </div>

        {/* 2. Worst Month */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Nejhorší měsíc</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-rose-400">
              {matrix.worstMonth ? `${matrix.worstMonth.returnPercent.toFixed(1)} %` : '—'}
            </span>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {matrix.worstMonth ? `${matrix.worstMonth.monthLabel} ${matrix.worstMonth.year}` : 'Žádná data'}
            </p>
          </div>
        </div>

        {/* 3. Positive Months Win Rate */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ziskové měsíce</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-100">
              {matrix.winRateMonthsPercent.toFixed(1)} %
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {matrix.positiveMonthsCount} z {matrix.totalMonthsCount} měsíců
            </p>
          </div>
        </div>

        {/* 4. Average Monthly Return */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Průměrný měsíc</span>
            <Percent className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold ${matrix.averageMonthlyReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {matrix.averageMonthlyReturnPercent >= 0 ? '+' : ''}{matrix.averageMonthlyReturnPercent.toFixed(1)} %
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Aritmetický průměr
            </p>
          </div>
        </div>

        {/* 5. Compound CAGR */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Anualizovaný CAGR</span>
            <Award className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold ${matrix.annualizedCagrPercent >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
              {matrix.annualizedCagrPercent >= 0 ? '+' : ''}{matrix.annualizedCagrPercent.toFixed(1)} %
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Roční tempo růstu (p.a.)
            </p>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Table */}
      <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 text-left w-16">Rok</th>
              {CZECH_MONTHS_SHORT.map((m) => (
                <th key={m} className="py-2.5 px-2 min-w-[52px]">
                  {m}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[70px] text-right font-bold text-slate-200 bg-slate-800/50">
                YTD
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {matrix.years.map((row) => (
              <tr key={row.year} className="hover:bg-slate-800/20 transition-colors">
                <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-200">
                  {row.year}
                </td>
                {row.months.map((cell, idx) => {
                  if (!cell) {
                    return (
                      <td key={idx} className="py-2 px-1 text-slate-600 font-mono text-[11px]">
                        —
                      </td>
                    );
                  }

                  const ret = cell.returnPercent;
                  const bgClass = getCellBg(ret);

                  return (
                    <td
                      key={idx}
                      className="py-1 px-1 relative group cursor-pointer"
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={`py-1.5 px-1 rounded-lg border text-[11px] transition-transform duration-150 hover:scale-105 ${bgClass}`}
                      >
                        {ret > 0 ? `+${ret.toFixed(1)}` : ret.toFixed(1)}%
                      </div>
                    </td>
                  );
                })}
                <td className="py-1 px-2 text-right">
                  <div className={`py-1.5 px-2 rounded-lg border text-xs font-mono font-bold ${getYtdBg(row.ytdReturnPercent)}`}>
                    {row.ytdReturnPercent > 0 ? `+${row.ytdReturnPercent.toFixed(1)}` : row.ytdReturnPercent.toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Hover Cell Detail Tooltip Card */}
      {hoveredCell && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">
                {hoveredCell.monthLabel} {hoveredCell.year}
              </div>
              <div className="text-xs text-slate-400">
                Měsíční výnos:{' '}
                <span className={hoveredCell.returnPercent >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {hoveredCell.returnPercent >= 0 ? '+' : ''}{hoveredCell.returnPercent.toFixed(1)} %
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">ČISTÝ ZISK</span>
              <span className={`font-mono font-bold ${hoveredCell.profitTarget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <MoneyDisplay amount={hoveredCell.profitTarget} currency={displayCurrency} />
              </span>
            </div>
            {hoveredCell.netInflowTarget > 0 && (
              <div>
                <span className="text-slate-500 block text-[10px]">NOVÝ VKLAD</span>
                <span className="font-mono text-slate-200">
                  <MoneyDisplay amount={hoveredCell.netInflowTarget} currency={displayCurrency} />
                </span>
              </div>
            )}
            {hoveredCell.dividendIncomeTarget && hoveredCell.dividendIncomeTarget > 0 ? (
              <div>
                <span className="text-slate-500 block text-[10px]">DIVIDENDY</span>
                <span className="font-mono text-cyan-300">
                  +<MoneyDisplay amount={hoveredCell.dividendIncomeTarget} currency={displayCurrency} />
                </span>
              </div>
            ) : null}
            <div>
              <span className="text-slate-500 block text-[10px]">NAV NA KONCI</span>
              <span className="font-mono text-slate-300">
                <MoneyDisplay amount={hoveredCell.endNavTarget} currency={displayCurrency} />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Info Notice */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/30 p-3 rounded-lg border border-slate-800/60">
        <Info className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Měsíční výnosy jsou váženy kapitálovými vklady podle metodiky Modified Dietz. Roční YTD hodnota využívá standardní geometrické propojování řady měsíců: $\prod (1 + r_m) - 1$.
        </span>
      </div>
    </div>
  );
};
