import React, { useState, useMemo, useRef, useCallback } from 'react';
import { TrendingUp, Sparkles, Calendar, Check, RotateCcw, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SalaryBonusConfig, SalaryProjectionYearPoint } from '@/types/budget';
import { BudgetService } from '@/lib/services/budgetService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface SalaryTrajectoryChartProps {
  baseMonthlyNetSalaryCZK: number;
  initialAnnualIncreasePercentage: number;
  bonuses?: SalaryBonusConfig[];
  onSaveAnnualIncrease?: (newPercentage: number) => Promise<void> | void;
}

export type SalaryViewMode = 'monthly' | 'real' | 'cumulative';

export const SalaryTrajectoryChart: React.FC<SalaryTrajectoryChartProps> = ({
  baseMonthlyNetSalaryCZK,
  initialAnnualIncreasePercentage,
  bonuses = [],
  onSaveAnnualIncrease,
}) => {
  const [horizonYears, setHorizonYears] = useState<number>(5);
  const [simulatedIncreasePct, setSimulatedIncreasePct] = useState<number>(initialAnnualIncreasePercentage || 5.0);
  const [viewMode, setViewMode] = useState<SalaryViewMode>('monthly');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG dimensions
  const VIEW_WIDTH = 760;
  const VIEW_HEIGHT = 240;
  const MARGIN_LEFT = 70;
  const MARGIN_RIGHT = 30;
  const MARGIN_TOP = 25;
  const MARGIN_BOTTOM = 40;

  const plotWidth = VIEW_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const plotHeight = VIEW_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const plotYBottom = VIEW_HEIGHT - MARGIN_BOTTOM;

  // Calculate year points
  const points: SalaryProjectionYearPoint[] = useMemo(() => {
    return BudgetService.generateSalaryProgression(
      baseMonthlyNetSalaryCZK,
      simulatedIncreasePct,
      horizonYears,
      bonuses,
      2.5 // inflation 2.5% p.a.
    );
  }, [baseMonthlyNetSalaryCZK, simulatedIncreasePct, horizonYears, bonuses]);

  // Max value based on mode
  const { maxVal, yTicks } = useMemo(() => {
    if (!points || points.length === 0) {
      return { maxVal: 100000, yTicks: [0, 25000, 50000, 75000, 100000] };
    }

    let highest = 0;
    for (const p of points) {
      if (viewMode === 'cumulative') {
        highest = Math.max(highest, p.cumulativeNetEarnedCZK);
      } else {
        highest = Math.max(highest, p.monthlyNetSalaryCZK);
      }
    }
    if (highest <= 0) highest = 100000;

    // Nice rounded ceiling
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    const normalized = highest / magnitude;
    let stepFactor = 1;
    if (normalized <= 2) stepFactor = 0.5;
    else if (normalized <= 5) stepFactor = 1;
    else stepFactor = 2;

    const tickStep = stepFactor * magnitude;
    const ceiling = Math.ceil((highest * 1.1) / tickStep) * tickStep;

    const ticks: number[] = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((ceiling / count) * i));
    }

    return { maxVal: ceiling, yTicks: ticks };
  }, [points, viewMode]);

  // Transform coordinates for each year
  const coords = useMemo(() => {
    if (points.length === 0) return [];
    const n = points.length;

    return points.map((p, i) => {
      const x = MARGIN_LEFT + (n > 1 ? (i / (n - 1)) * plotWidth : plotWidth / 2);

      const yMonthly = plotYBottom - (p.monthlyNetSalaryCZK / maxVal) * plotHeight;
      const yReal = plotYBottom - (p.realPurchasingPowerMonthlyCZK / maxVal) * plotHeight;
      const yCumulative = plotYBottom - (p.cumulativeNetEarnedCZK / maxVal) * plotHeight;

      return {
        point: p,
        index: i,
        x,
        yMonthly,
        yReal,
        yCumulative,
      };
    });
  }, [points, maxVal, plotWidth, plotHeight, plotYBottom, MARGIN_LEFT]);

  // SVG Paths
  const paths = useMemo(() => {
    if (coords.length === 0) return null;
    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;

    // Monthly Net Salary Path
    const monthlyTop = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yMonthly.toFixed(1)}`).join(' ');
    const monthlyArea = `${monthlyTop} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    // Real Salary Path
    const realTop = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yReal.toFixed(1)}`).join(' ');
    const realArea = `${realTop} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    // Cumulative Path
    const cumulativeTop = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yCumulative.toFixed(1)}`).join(' ');
    const cumulativeArea = `${cumulativeTop} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    return {
      monthlyTop,
      monthlyArea,
      realTop,
      realArea,
      cumulativeTop,
      cumulativeArea,
    };
  }, [coords, plotYBottom]);

  // Mouse hover handler
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * VIEW_WIDTH;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const dist = Math.abs(coords[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  }, [coords]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const handleSaveIncrease = async () => {
    if (onSaveAnnualIncrease) {
      await onSaveAnnualIncrease(simulatedIncreasePct);
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2500);
    }
  };

  const formatTickLabel = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
    return `${val}`;
  };

  const activeCoord = hoverIndex !== null && coords[hoverIndex]
    ? coords[hoverIndex]
    : coords[coords.length - 1];

  const hasUnsavedChanges = Math.abs(simulatedIncreasePct - initialAnnualIncreasePercentage) > 0.05;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Vývoj čisté mzdy v čase</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                +{simulatedIncreasePct.toFixed(1)} % ročně
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Kariérní růst a valorizace: jak poroste vaše výplata a celkový příjem v horizontu {horizonYears} let
            </p>
          </div>
        </div>

        {/* View Mode & Horizon Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {[3, 5, 10, 15].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setHorizonYears(yr)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  horizonYears === yr
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {yr}r
              </button>
            ))}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'monthly'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Měsíční mzda
            </button>
            <button
              type="button"
              onClick={() => setViewMode('real')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'real'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Reálná s inflací
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'cumulative'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kumulativně
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Career Escalator Slider Bar */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200">
              Simulace roční valorizace mzdy (% p.a.):
            </span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              +{simulatedIncreasePct.toFixed(1)} % ročně
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && onSaveAnnualIncrease && (
              <button
                type="button"
                onClick={handleSaveIncrease}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm"
              >
                {isSavedRecently ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{isSavedRecently ? 'Uloženo do profilu!' : 'Uložit toto % pro rozpočet'}</span>
              </button>
            )}
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={() => setSimulatedIncreasePct(initialAnnualIncreasePercentage)}
                title="Vrátit na původně uloženou hodnotu"
                className="p-1 rounded text-slate-500 hover:text-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <input
            type="range"
            min="0"
            max="18.0"
            step="0.5"
            value={simulatedIncreasePct}
            onChange={(e) => setSimulatedIncreasePct(parseFloat(e.target.value))}
            className="w-full sm:flex-1 accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />

          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-1">
            {[0, 3, 5, 7, 10, 15].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSimulatedIncreasePct(pct)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                  simulatedIncreasePct === pct
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                {pct === 0 ? '0%' : `+${pct}%${pct === 5 ? ' (Výchozí)' : ''}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Native SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-[220px] sm:h-[250px] block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="salaryMonthlyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.08} />
            </linearGradient>

            <linearGradient id="salaryRealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.08} />
            </linearGradient>

            <linearGradient id="salaryCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.10} />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((tick) => {
            const y = plotYBottom - (tick / maxVal) * plotHeight;
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={MARGIN_LEFT}
                  y1={y}
                  x2={VIEW_WIDTH - MARGIN_RIGHT}
                  y2={y}
                  stroke="#1E293B"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={MARGIN_LEFT - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatTickLabel(tick)} Kč
                </text>
              </g>
            );
          })}

          {/* Paths & Areas */}
          {paths && (
            <>
              {viewMode === 'monthly' && (
                <>
                  <path d={paths.monthlyArea} fill="url(#salaryMonthlyGradient)" />
                  <path
                    d={paths.monthlyTop}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {viewMode === 'real' && (
                <>
                  <path d={paths.monthlyArea} fill="url(#salaryMonthlyGradient)" opacity={0.4} />
                  <path
                    d={paths.monthlyTop}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <path d={paths.realArea} fill="url(#salaryRealGradient)" />
                  <path
                    d={paths.realTop}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {viewMode === 'cumulative' && (
                <>
                  <path d={paths.cumulativeArea} fill="url(#salaryCumulativeGradient)" />
                  <path
                    d={paths.cumulativeTop}
                    fill="none"
                    stroke="#818CF8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </>
          )}

          {/* Dots on points */}
          {coords.map((c) => {
            const currentY =
              viewMode === 'cumulative'
                ? c.yCumulative
                : viewMode === 'real'
                ? c.yReal
                : c.yMonthly;

            const isHovered = hoverIndex === c.index;

            return (
              <g key={`pt-${c.point.year}`}>
                <circle
                  cx={c.x}
                  cy={currentY}
                  r={isHovered ? 6 : 4}
                  fill={viewMode === 'cumulative' ? '#818CF8' : viewMode === 'real' ? '#F59E0B' : '#10B981'}
                  stroke="#0B0E14"
                  strokeWidth="2"
                  className="transition-all"
                />
                {/* Year Label on X axis */}
                <text
                  x={c.x}
                  y={plotYBottom + 18}
                  textAnchor="middle"
                  fill={isHovered ? '#FFFFFF' : '#94A3B8'}
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fontFamily="monospace"
                >
                  {c.point.yearLabel}
                </text>
              </g>
            );
          })}

          {/* Interactive Hover Crosshair */}
          {activeCoord && hoverIndex !== null && (
            <g>
              <line
                x1={activeCoord.x}
                y1={MARGIN_TOP}
                x2={activeCoord.x}
                y2={plotYBottom}
                stroke="#818CF8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {/* Legend pills under chart */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 px-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {viewMode === 'monthly' && (
              <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                <span>Měsíční čistá mzda (+{simulatedIncreasePct.toFixed(1)} % p.a.)</span>
              </div>
            )}
            {viewMode === 'real' && (
              <>
                <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <span className="w-3 h-2 border-b-2 border-dashed border-emerald-400 inline-block" />
                  <span>Nominální mzda</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-amber-400">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span>Reálná kupní síla (očistěná o inflaci 2,5 % p.a.)</span>
                </div>
              </>
            )}
            {viewMode === 'cumulative' && (
              <div className="flex items-center gap-1.5 font-medium text-indigo-400">
                <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                <span>Kumulativní vyplacený čistý výdělek odteď</span>
              </div>
            )}
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {hoverIndex !== null ? 'Přejeďte myší pro detail roku' : `Zobrazen ${horizonYears}. rok`}
          </span>
        </div>
      </div>

      {/* Detailed Snapshot Card for Active / Hovered Year */}
      {activeCoord && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 shadow-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {/* 1. Období a čistá mzda */}
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">
              {activeCoord.point.year === 0 ? 'Výchozí stav (Dnes)' : `${activeCoord.point.year}. rok kariéry`}
            </div>
            <div className="text-lg font-bold text-emerald-400 flex items-baseline gap-1.5">
              <MoneyDisplay amount={activeCoord.point.monthlyNetSalaryCZK} />
              <span className="text-xs font-normal text-slate-400">/ měs</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-0.5">
              {activeCoord.point.year === 0 ? (
                'Základní čistá mzda'
              ) : (
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>+<MoneyDisplay amount={activeCoord.point.monthlyNetIncreaseCZK} />/měs (+{activeCoord.point.percentageIncrease} %)</span>
                </span>
              )}
            </div>
          </div>

          {/* 2. Reálná kupní síla po inflaci */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-amber-400 font-semibold mb-0.5">
              Reálná kupní síla (při 2.5% inflaci):
            </div>
            <div className="text-base font-bold text-amber-300">
              <MoneyDisplay amount={activeCoord.point.realPurchasingPowerMonthlyCZK} />
              <span className="text-xs font-normal text-slate-400 ml-1">/ měs</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              {activeCoord.point.realPurchasingPowerMonthlyCZK > baseMonthlyNetSalaryCZK ? (
                <span className="text-emerald-400">Reálně bohatnete o +{Math.round((activeCoord.point.realPurchasingPowerMonthlyCZK - baseMonthlyNetSalaryCZK)).toLocaleString()} Kč/měs</span>
              ) : (
                <span>Ekvivalent dnešních peněz</span>
              )}
            </div>
          </div>

          {/* 3. Roční příjem celkem */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-indigo-400 font-semibold mb-0.5">
              Roční příjem celkem v tomto roce:
            </div>
            <div className="text-base font-bold text-white">
              <MoneyDisplay amount={activeCoord.point.totalAnnualNetIncomeCZK} />
              <span className="text-xs font-normal text-slate-400 ml-1">/ rok</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              12x mzda ({Math.round(activeCoord.point.annualNetSalaryCZK / 1000)}k)
              {activeCoord.point.annualBonusesCZK > 0 && ` + bonusy (${Math.round(activeCoord.point.annualBonusesCZK / 1000)}k)`}
            </div>
          </div>

          {/* 4. Kumulativní výdělek */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-slate-400 mb-0.5">
              Kumulativně vyděláno odteď:
            </div>
            <div className="text-base font-bold text-indigo-300">
              <MoneyDisplay amount={activeCoord.point.cumulativeNetEarnedCZK} />
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              Celkový čistý příjem za {activeCoord.point.year + 1} {activeCoord.point.year === 0 ? 'rok' : activeCoord.point.year < 4 ? 'roky' : 'let'} práce
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
