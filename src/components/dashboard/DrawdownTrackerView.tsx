import React, { useMemo } from 'react';
import {
  Waves,
  TrendingDown,
  ShieldAlert,
  Calendar,
  Award,
  CheckCircle2,
  Info,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ValuationDetail } from '@/types/portfolio';
import { PerformanceService } from '@/lib/services/performanceService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { useAutoWidth } from '@/lib/hooks/useAutoWidth';

interface DrawdownTrackerViewProps {
  valuations: ValuationDetail[];
}

export const DrawdownTrackerView: React.FC<DrawdownTrackerViewProps> = ({ valuations }) => {
  const lots = usePortfolioStore((s) => s.lots);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const { containerRef, width: chartWidth } = useAutoWidth(600);

  const performance = useMemo(() => {
    return PerformanceService.calculatePeriodPerformance(
      valuations,
      lots,
      'ALL',
      displayCurrency
    );
  }, [valuations, lots, displayCurrency]);

  const drawdown = useMemo(() => {
    return PerformanceService.calculateDrawdownAnalysis(
      performance.trajectory,
      performance.endValue
    );
  }, [performance]);

  const isAtAth = drawdown.currentDrawdownPercent >= -0.5;

  return (
    <div className="flex flex-col gap-6">
      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Aktuální vzdálenost od ATH */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Vzdálenost od ATH</span>
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span
              className={`text-lg font-bold font-mono ${
                isAtAth ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isAtAth ? 'Na maximu (ATH)' : `${drawdown.currentDrawdownPercent.toFixed(1)} %`}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAtAth ? (
                'Portfolio je na rekordu'
              ) : (
                <>
                  <MoneyDisplay
                    amount={drawdown.currentDrawdownAmountTarget}
                    currency={displayCurrency}
                  />{' '}
                  od vrcholu
                </>
              )}
            </p>
          </div>
        </div>

        {/* 2. Maximální propad (Max Drawdown) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Max Drawdown</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-rose-400">
              {drawdown.maxDrawdownPercent.toFixed(1)} %
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              <MoneyDisplay
                amount={drawdown.maxDrawdownAmountTarget}
                currency={displayCurrency}
              />
            </p>
          </div>
        </div>

        {/* 3. Poslední ATH Vrchol */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rekordní hodnota (ATH)</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">
              <MoneyDisplay
                amount={drawdown.currentAthValueTarget}
                currency={displayCurrency}
              />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Dosaženo {new Date(drawdown.currentAthDate).toLocaleDateString('cs-CZ')}
            </p>
          </div>
        </div>

        {/* 4. Doba v propadu / Zotavení */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Nejdelší propad</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-100">
              {drawdown.longestDrawdownDays} dní
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Čas do návratu na nový rekord
            </p>
          </div>
        </div>

        {/* 5. Odolnost portfolia */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Stabilita pro FIRE</span>
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-emerald-400">Vysoká</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Max DD pod -20 % limit
            </p>
          </div>
        </div>
      </div>

      {/* Visual Underwater Drawdown Area Chart */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              Underwater Křivka — Vzdálenost od historického maxima
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Hloubka a trvání tržních propadů pod historický vrchol (0 % = Nové ATH)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70 inline-block" />
              <span>Propad od ATH (%)</span>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="w-full h-56 pt-2">
          {chartWidth > 0 && (
            <AreaChart
              width={chartWidth}
              height={220}
              data={drawdown.trajectory}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.05} />
                  <stop offset="50%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[Math.min(-15, Math.floor(drawdown.maxDrawdownPercent * 1.2)), 0]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-3 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl text-xs flex flex-col gap-1.5 min-w-[200px]">
                        <span className="font-semibold text-slate-300">
                          {data.label} ({data.date})
                        </span>
                        <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800">
                          <span>Propad od ATH:</span>
                          <span
                            className={`font-mono font-bold ${
                              data.drawdownPercent >= -0.1 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {data.drawdownPercent >= -0.1 ? '0.0 % (ATH)' : `${data.drawdownPercent.toFixed(1)} %`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Částka pod ATH:</span>
                          <span className="font-mono text-rose-400 font-semibold">
                            <MoneyDisplay amount={data.drawdownAmountTarget} currency={displayCurrency} />
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Hodnota portfolia:</span>
                          <span className="font-mono text-slate-200">
                            <MoneyDisplay amount={data.portfolioValueTarget} currency={displayCurrency} />
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Předchozí vrchol:</span>
                          <span className="font-mono text-amber-300">
                            <MoneyDisplay amount={data.peakValueTarget} currency={displayCurrency} />
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="drawdownPercent"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#drawdownGradient)"
              />
            </AreaChart>
          )}
        </div>
      </div>

      {/* FIRE Guidance Box */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 text-xs text-slate-400 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Význam Max Drawdownu pro rentiéra (FIRE)</span>
        </div>
        <p>
          Sequence of Returns Risk (riziko pořadí výnosů) je největším nebezpečím v prvních 3–5 letech čerpání renty. Pokud trh zaznamená propad o více než 20 %, prodej aktiv za snížené ceny trvale vyčerpává jistinu. Řešením je udržování 12–24měsíční hotovostní rezervy (Cash bufferu), která zabraňuje vynuceným prodejům v propadu.
        </p>
      </div>
    </div>
  );
};
