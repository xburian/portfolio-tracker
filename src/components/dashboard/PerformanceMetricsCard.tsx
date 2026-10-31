import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useAutoWidth } from '@/lib/hooks/useAutoWidth';
import { CurrencyCode, PositionLot, ValuationDetail } from '@/types/portfolio';
import { PerformanceService, PerformancePeriod } from '@/lib/services/performanceService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DeltaBadge } from '@/components/common/DeltaBadge';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

interface PerformanceMetricsCardProps {
  valuations: ValuationDetail[];
}

export const PerformanceMetricsCard: React.FC<PerformanceMetricsCardProps> = ({ valuations }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('YTD');
  const lots = usePortfolioStore((s) => s.lots);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const { containerRef, width: chartWidth } = useAutoWidth(600);

  const performance = useMemo(() => {
    return PerformanceService.calculatePeriodPerformance(
      valuations,
      lots,
      selectedPeriod,
      displayCurrency
    );
  }, [valuations, lots, selectedPeriod, displayCurrency]);

  const periods: { id: PerformancePeriod; label: string; sub: string }[] = [
    { id: 'YTD', label: 'Od začátku roku', sub: 'YTD 2026' },
    { id: '1Y', label: '1 rok', sub: 'Posledních 12M' },
    { id: '3Y', label: '3 roky', sub: 'Časový test' },
    { id: '5Y', label: '5 let', sub: 'Dlouhodobý' },
    { id: 'ALL', label: 'Celkem', sub: 'Od vzniku' },
  ];

  const isAlphaPositive = performance.alpha >= 0;

  return (
    <div className="bg-[#0F1420] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
      {/* Top Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100 tracking-tight">
              Výkonnost portfolia & Benchmarky
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Zhodnocení v čase podle standardu GIPS (Modified Dietz) se zohledněním průběžných vkladů
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium overflow-x-auto">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                selectedPeriod === p.id
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats 3-Column Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Čistý vytvořený zisk za období */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Čistý zisk za období ({selectedPeriod})</span>
            <span className="font-mono text-[10px] text-slate-500">
              {performance.durationDays} dní
            </span>
          </div>

          <div className="my-2.5">
            <MoneyDisplay
              amount={performance.netProfit}
              showSign
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                performance.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            />
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <DeltaBadge valuePercent={performance.moneyWeightedReturnPercent} />
              {performance.annualizedReturnPercent !== undefined && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {performance.annualizedReturnPercent >= 0 ? '+' : ''}
                  {performance.annualizedReturnPercent.toFixed(1)} % p.a.
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span>Počátek: <MoneyDisplay amount={performance.startValue} className="font-semibold text-slate-400" /></span>
            <span>Konec: <MoneyDisplay amount={performance.endValue} className="font-semibold text-slate-300" /></span>
          </div>
        </div>

        {/* 2. Srovnání s S&P 500 (Alpha) */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Srovnání s indexem S&P 500</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="my-2.5">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${isAlphaPositive ? 'text-emerald-400' : 'text-indigo-300'}`}>
                {performance.alpha >= 0 ? '+' : ''}{performance.alpha.toFixed(1)} %
              </span>
              <span className="text-xs text-slate-400 font-medium">Alpha</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              S&P 500 TR: <span className="font-mono font-semibold text-slate-200">+{performance.benchmarkSp500ReturnPercent.toFixed(1)} %</span>
              <span className="mx-1">•</span>
              All-World: <span className="font-mono font-semibold text-slate-200">+{performance.benchmarkAllWorldReturnPercent.toFixed(1)} %</span>
            </p>
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
            {isAlphaPositive
              ? 'Portfolio překonává pasivní americký index S&P 500.'
              : 'Portfolio těsně kopíruje trh se stabilizační hotovostní rezervou.'}
          </div>
        </div>

        {/* 3. Pohyby kapitálu & Vklady */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Nové vklady v období</span>
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          <div className="my-2.5">
            <MoneyDisplay
              amount={performance.newCapitalInvested}
              className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight"
            />
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
              <span>Zisk tvoří</span>
              <span className="font-mono font-bold text-emerald-400">
                {performance.netProfit > 0 && performance.endValue > 0
                  ? `${((performance.netProfit / performance.endValue) * 100).toFixed(1)} %`
                  : '0 %'}
              </span>
              <span>hodnoty portfolia</span>
            </div>
          </div>

          {/* Capital composition visual bar */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{
                  width: `${performance.endValue > 0 ? (performance.startValue / performance.endValue) * 100 : 0}%`,
                }}
                title="Původní hodnota"
              />
              <div
                className="bg-cyan-500 h-full transition-all duration-300"
                style={{
                  width: `${performance.endValue > 0 ? (performance.newCapitalInvested / performance.endValue) * 100 : 0}%`,
                }}
                title="Nové nákupy"
              />
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${performance.endValue > 0 ? Math.max(0, (performance.netProfit / performance.endValue) * 100) : 0}%`,
                }}
                title="Čistý zisk"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span className="text-indigo-400">Počátek</span>
              <span className="text-cyan-400">Nové nákupy</span>
              <span className="text-emerald-400">Zisk</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Sparkline & Top Contributors Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left: Trajectory Area Chart */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold text-slate-200">
                Křivka růstu portfolia ({performance.periodLabel})
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Vývoj celkové hodnoty a kumulovaného vloženého kapitálu
              </p>
            </div>
            <span className="text-[11px] font-mono text-indigo-400 font-semibold">
              {performance.startDate} → {performance.endDate}
            </span>
          </div>

          <div ref={containerRef} className="h-[210px] w-full min-h-[210px] relative overflow-hidden min-w-0">
            <AreaChart width={chartWidth} height={210} data={performance.trajectory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="performanceValueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="performanceInvestedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as (typeof performance.trajectory)[0];
                      return (
                        <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800 text-xs shadow-xl">
                          <span className="font-semibold text-slate-200 block mb-1 font-mono">{data.date}</span>
                          <div className="flex items-center justify-between gap-4 text-emerald-400">
                            <span>Hodnota:</span>
                            <MoneyDisplay amount={data.value} className="font-bold" />
                          </div>
                          <div className="flex items-center justify-between gap-4 text-slate-400 mt-0.5">
                            <span>Vloženo:</span>
                            <MoneyDisplay amount={data.invested} />
                          </div>
                          <div className="flex items-center justify-between gap-4 text-indigo-400 font-semibold mt-0.5 pt-1 border-t border-slate-800">
                            <span>Zisk:</span>
                            <MoneyDisplay amount={data.profit} showSign />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#performanceValueGrad)"
                  name="Hodnota portfolia"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stroke="#6366F1"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  fillOpacity={1}
                  fill="url(#performanceInvestedGrad)"
                  name="Vložený kapitál"
                  isAnimationActive={false}
                />
              </AreaChart>
          </div>
        </div>

        {/* Right: Top Contributors (Tahouni výkonnosti) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200">
                Hlavní tahouni zisku v období
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Příspěvek k výnosu</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Tituly, které nejvíce přispěly k zhodnocení v horizontu {performance.periodLabel}
            </p>

            <div className="flex flex-col gap-2">
              {performance.topWinners.slice(0, 4).map((winner) => (
                <div
                  key={winner.ticker}
                  className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {winner.ticker}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        +{winner.periodReturnPercent.toFixed(1)} %
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {winner.name}
                    </span>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <MoneyDisplay
                      amount={winner.profitTarget}
                      showSign
                      className="text-xs font-mono font-bold text-emerald-400"
                    />
                    <span className="text-[10px] font-mono text-indigo-400">
                      +{winner.contributionPercent.toFixed(1)} % k portfoliu
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Metodika: GIPS Modified Dietz</span>
            <span className="text-indigo-400 font-medium">Reálné nákupní loty</span>
          </div>
        </div>
      </div>
    </div>
  );
};
