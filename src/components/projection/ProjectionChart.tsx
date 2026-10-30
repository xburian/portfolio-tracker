import React from 'react';
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

interface ProjectionChartProps {
  data: ProjectionDataPoint[];
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  return (
    <div className="w-full h-[320px] sm:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
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
                  <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs font-mono">
                    <div className="font-bold text-slate-200 mb-1.5">Rok {point.year}</div>
                    <div className="flex items-center justify-between gap-4 py-0.5">
                      <span className="text-emerald-400">Celková hodnota:</span>
                      <MoneyDisplay amount={point.nominalValue} className="font-bold text-white" />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5">
                      <span className="text-indigo-400">Vložený kapitál:</span>
                      <MoneyDisplay amount={point.principalInvested} className="text-slate-300" />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5">
                      <span className="text-emerald-400 font-semibold">Složený úrok (zisk):</span>
                      <MoneyDisplay amount={point.compoundInterestGain} className="font-bold text-emerald-400" />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5 text-slate-500 border-t border-slate-800 mt-1 pt-1">
                      <span>Reálná hodnota (po inflaci):</span>
                      <MoneyDisplay amount={point.realValue} className="text-slate-400" />
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
