import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ProjectionDataPoint } from '@/lib/services/fireService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { Layers, TrendingUp } from 'lucide-react';

interface ProjectionChartProps {
  data: ProjectionDataPoint[];
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  const [chartMode, setChartMode] = useState<'assets' | 'growth'>('assets');

  return (
    <div className="flex flex-col gap-3">
      {/* Chart mode switcher */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Zobrazení trajektorie:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setChartMode('assets')}
            className={`px-3 py-1 rounded-lg transition-all font-medium ${
              chartMode === 'assets'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Akcie vs. Spořící účet
          </button>
          <button
            type="button"
            onClick={() => setChartMode('growth')}
            className={`px-3 py-1 rounded-lg transition-all font-medium ${
              chartMode === 'growth'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vložený kapitál vs. Zisk
          </button>
        </div>
      </div>

      <div className="w-full h-[320px] sm:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {/* Asset mode gradients */}
              <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.05} />
              </linearGradient>

              {/* Growth mode gradients */}
              <linearGradient id="gainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="year"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              tickFormatter={(year) => `${year}r`}
            />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              tickFormatter={(val) => {
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
                return val;
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const point = payload[0].payload as ProjectionDataPoint;
                  return (
                    <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[240px]">
                      <div className="font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                        <span>Rok {point.year}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Měsíc {point.month}</span>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1 border-b border-slate-800/80 mb-1.5">
                        <span className="text-slate-300 font-semibold">Celkové bohatství:</span>
                        <MoneyDisplay amount={point.nominalValue} className="font-bold text-white text-sm" />
                      </div>

                      {/* 2-bucket breakdown */}
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center justify-between gap-3 text-emerald-400">
                          <span className="flex items-center gap-1 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                            <span>Investice (Akcie):</span>
                          </span>
                          <MoneyDisplay amount={point.stocksValue} className="font-bold text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pl-3">
                          <span>Vklady / zisk:</span>
                          <span>
                            <MoneyDisplay amount={point.stocksPrincipalInvested} /> / +<MoneyDisplay amount={point.stocksCompoundGain} />
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sky-400 pt-1">
                          <span className="flex items-center gap-1 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                            <span>Spořící účet:</span>
                          </span>
                          <MoneyDisplay amount={point.savingsValue} className="font-bold text-sky-400" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pl-3">
                          <span>Vklady / úroky:</span>
                          <span>
                            <MoneyDisplay amount={point.savingsPrincipalInvested} /> / +<MoneyDisplay amount={point.savingsInterestGain} />
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1 text-slate-400 border-t border-slate-800/80 mt-1 pt-1.5">
                        <span>Celkový zisk:</span>
                        <MoneyDisplay amount={point.compoundInterestGain} className="font-semibold text-emerald-300" />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-0.5 text-slate-500 text-[10px]">
                        <span>Po inflaci (kupní síla):</span>
                        <MoneyDisplay amount={point.realValue} className="text-slate-400" />
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {chartMode === 'assets' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="savingsValue"
                  stackId="1"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  fill="url(#savingsGradient)"
                  name="Spořící účet"
                />
                <Area
                  type="monotone"
                  dataKey="stocksValue"
                  stackId="1"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#stocksGradient)"
                  name="Investice (Akcie & ETF)"
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="principalInvested"
                  stackId="1"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#principalGradient)"
                  name="Vložený kapitál"
                />
                <Area
                  type="monotone"
                  dataKey="compoundInterestGain"
                  stackId="1"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#gainGradient)"
                  name="Složený úrok (zisk)"
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
