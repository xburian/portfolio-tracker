import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ProjectionDataPoint } from '@/lib/services/fireService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { Layers, TrendingUp, Shield, Sparkles, DollarSign, Wallet } from 'lucide-react';

interface ProjectionChartProps {
  data: ProjectionDataPoint[];
}

export type ChartDisplayMode = 'assets' | 'growth' | 'inflation';

export const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  const [chartMode, setChartMode] = useState<ChartDisplayMode>('assets');
  const [showDispersion, setShowDispersion] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas geometry constants
  const VIEW_WIDTH = 1000;
  const VIEW_HEIGHT = 380;
  const MARGIN_LEFT = 75;
  const MARGIN_RIGHT = 30;
  const MARGIN_TOP = 25;
  const MARGIN_BOTTOM = 45;

  const plotWidth = VIEW_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const plotHeight = VIEW_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const plotYBottom = VIEW_HEIGHT - MARGIN_BOTTOM;

  const dispersionPct = useMemo(() => {
    return data?.find((d) => d.dispersionPercent !== undefined)?.dispersionPercent;
  }, [data]);

  // Max value calculation with nice round ceiling (incorporating upper variance boundary)
  const { maxVal, yTicks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { maxVal: 1000000, yTicks: [0, 250000, 500000, 750000, 1000000] };
    }

    let highest = 0;
    for (const d of data) {
      highest = Math.max(
        highest,
        d.nominalValue,
        d.principalInvested,
        d.stocksValue + d.savingsValue,
        d.varianceUpperValue ?? 0
      );
    }
    if (highest <= 0) highest = 100000;

    // Nice ceiling calculation (100k, 250k, 500k, 1M, 2M, 5M step)
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    const normalized = highest / magnitude;
    let stepFactor = 1;
    if (normalized <= 2) stepFactor = 0.5;
    else if (normalized <= 5) stepFactor = 1;
    else stepFactor = 2;

    const tickStep = stepFactor * magnitude;
    const ceiling = Math.ceil((highest * 1.08) / tickStep) * tickStep;

    const ticks: number[] = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((ceiling / count) * i));
    }

    return { maxVal: ceiling, yTicks: ticks };
  }, [data]);

  // Transform coordinates for each point
  const pointsWithCoords = useMemo(() => {
    if (!data || data.length === 0) return [];
    const n = data.length;

    return data.map((d, i) => {
      const x = MARGIN_LEFT + (n > 1 ? (i / (n - 1)) * plotWidth : plotWidth / 2);

      // Y coordinates according to modes
      // 1. Assets mode (savings at bottom, stocks stacked on top)
      const ySavings = plotYBottom - (d.savingsValue / maxVal) * plotHeight;
      const yTotal = plotYBottom - ((d.stocksValue + d.savingsValue) / maxVal) * plotHeight;

      // 2. Growth mode (principal invested at bottom, compound gain on top)
      const yPrincipal = plotYBottom - (d.principalInvested / maxVal) * plotHeight;
      const yNominal = plotYBottom - (d.nominalValue / maxVal) * plotHeight;

      // 3. Inflation mode
      const yReal = plotYBottom - (d.realValue / maxVal) * plotHeight;

      // 4. Dispersion / Confidence Cone
      const yVarianceUpper = d.varianceUpperValue !== undefined
        ? plotYBottom - (d.varianceUpperValue / maxVal) * plotHeight
        : undefined;
      const yVarianceLower = d.varianceLowerValue !== undefined
        ? plotYBottom - (d.varianceLowerValue / maxVal) * plotHeight
        : undefined;

      return {
        point: d,
        index: i,
        x,
        ySavings,
        yTotal,
        yPrincipal,
        yNominal,
        yReal,
        yVarianceUpper,
        yVarianceLower,
      };
    });
  }, [data, maxVal, plotWidth, plotHeight, plotYBottom, MARGIN_LEFT]);

  // SVG Paths generation
  const paths = useMemo(() => {
    if (pointsWithCoords.length === 0) return null;
    const pts = pointsWithCoords;
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;

    // Mode: Assets (Akcie vs Spořící účet)
    // Area 1: Savings (bottom to savings value)
    const savingsTopLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.ySavings.toFixed(1)}`).join(' ');
    const savingsAreaPath = `${savingsTopLine} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    // Area 2: Stocks (stacked on top of savings)
    const totalTopLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yTotal.toFixed(1)}`).join(' ');
    const savingsReverseLine = pts.slice().reverse().map((p) => `L ${p.x.toFixed(1)} ${p.ySavings.toFixed(1)}`).join(' ');
    const stocksAreaPath = `${totalTopLine} ${savingsReverseLine} Z`;

    // Mode: Growth (Vložený kapitál vs Zisk)
    const principalTopLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yPrincipal.toFixed(1)}`).join(' ');
    const principalAreaPath = `${principalTopLine} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    const gainTopLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yNominal.toFixed(1)}`).join(' ');
    const principalReverseLine = pts.slice().reverse().map((p) => `L ${p.x.toFixed(1)} ${p.yPrincipal.toFixed(1)}`).join(' ');
    const gainAreaPath = `${gainTopLine} ${principalReverseLine} Z`;

    // Mode: Inflation (Real vs Nominal)
    const realTopLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yReal.toFixed(1)}`).join(' ');
    const realAreaPath = `${realTopLine} L ${lastX.toFixed(1)} ${plotYBottom} L ${firstX.toFixed(1)} ${plotYBottom} Z`;

    // Dispersion Corridor Envelope (Upper & Lower bounds polygon)
    const hasVariance = pts.some((p) => p.yVarianceUpper !== undefined && p.yVarianceLower !== undefined);
    let dispersionConeAreaPath = '';
    let varianceUpperLine = '';
    let varianceLowerLine = '';

    if (hasVariance) {
      varianceUpperLine = pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${(p.yVarianceUpper ?? p.yTotal).toFixed(1)}`)
        .join(' ');
      const varianceLowerReverse = pts
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${(p.yVarianceLower ?? p.yTotal).toFixed(1)}`)
        .join(' ');
      dispersionConeAreaPath = `${varianceUpperLine} ${varianceLowerReverse} Z`;
      varianceLowerLine = pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${(p.yVarianceLower ?? p.yTotal).toFixed(1)}`)
        .join(' ');
    }

    return {
      savingsAreaPath,
      stocksAreaPath,
      totalTopLine,
      principalAreaPath,
      gainAreaPath,
      gainTopLine,
      realAreaPath,
      realTopLine,
      hasVariance,
      dispersionConeAreaPath,
      varianceUpperLine,
      varianceLowerLine,
    };
  }, [pointsWithCoords, plotYBottom]);

  // Handle interactive mouse hovering over the SVG
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || pointsWithCoords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * VIEW_WIDTH;

    // Find closest point by X coordinate
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < pointsWithCoords.length; i++) {
      const dist = Math.abs(pointsWithCoords[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  }, [pointsWithCoords]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  // Format tick labels
  const formatYValue = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
    return `${val}`;
  };

  // Determine active point for tooltip
  const activeCoord = hoverIndex !== null && pointsWithCoords[hoverIndex]
    ? pointsWithCoords[hoverIndex]
    : pointsWithCoords.length > 0
    ? pointsWithCoords[pointsWithCoords.length - 1] // default to final horizon point
    : null;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Zobrazení trajektorie bohatství</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                {data.length} milníků
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Interaktivní křivka vývoje majetku v čase (přejeďte myší pro detail měsíce)
            </p>
          </div>
        </div>

        {/* View mode toggle pills & Dispersion Corridor Switch */}
        <div className="flex flex-wrap items-center gap-2">
          {paths?.hasVariance && (
            <button
              type="button"
              onClick={() => setShowDispersion((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${
                showDispersion
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50 shadow-md font-semibold'
                  : 'bg-slate-950/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title="Zobrazit / skrýt koridor rozptylu (volatilitu výnosu)"
            >
              <span className={`w-2 h-2 rounded-full ${showDispersion ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>Rozptyl {dispersionPct !== undefined ? `(±${dispersionPct} %)` : ''}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('assets')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                chartMode === 'assets'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Akcie vs. Spořící účet
            </button>
            <button
              type="button"
              onClick={() => setChartMode('growth')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                chartMode === 'growth'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vložený kapitál vs. Zisk
            </button>
            <button
              type="button"
              onClick={() => setChartMode('inflation')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                chartMode === 'inflation'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vliv inflace
            </button>
          </div>
        </div>
      </div>

      {/* Main Native SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-[320px] sm:h-[380px] block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Asset Mode Gradients */}
            <linearGradient id="stocksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.12} />
            </linearGradient>
            <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.15} />
            </linearGradient>

            {/* Growth Mode Gradients */}
            <linearGradient id="gainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.12} />
            </linearGradient>

            {/* Inflation Mode Gradients */}
            <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.12} />
            </linearGradient>

            {/* Dispersion Corridor Gradient */}
            <linearGradient id="dispersionConeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#818CF8" stopOpacity={0.06} />
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
                  x={MARGIN_LEFT - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {formatYValue(tick)} Kč
                </text>
              </g>
            );
          })}

          {/* Dispersion / Volatility Corridor */}
          {paths && paths.hasVariance && showDispersion && paths.dispersionConeAreaPath && (
            <g className="dispersion-corridor" opacity={chartMode === 'inflation' ? 0.35 : 0.85}>
              <path d={paths.dispersionConeAreaPath} fill="url(#dispersionConeGradient)" />
              <path
                d={paths.varianceUpperLine}
                fill="none"
                stroke="#818CF8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity={0.9}
              />
              <path
                d={paths.varianceLowerLine}
                fill="none"
                stroke="#818CF8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity={0.9}
              />
            </g>
          )}

          {/* Area & Stroke Paths */}
          {paths && (
            <>
              {chartMode === 'assets' && (
                <>
                  {/* Savings Area (bottom layer) */}
                  <path d={paths.savingsAreaPath} fill="url(#savingsGradient)" />
                  {/* Stocks Area (stacked on top) */}
                  <path d={paths.stocksAreaPath} fill="url(#stocksGradient)" />
                  {/* Total Top Glow Line */}
                  <path
                    d={paths.totalTopLine}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {chartMode === 'growth' && (
                <>
                  {/* Principal Invested Area (bottom layer) */}
                  <path d={paths.principalAreaPath} fill="url(#principalGradient)" />
                  {/* Compound Gain Area (stacked on top) */}
                  <path d={paths.gainAreaPath} fill="url(#gainGradient)" />
                  {/* Total Top Glow Line */}
                  <path
                    d={paths.gainTopLine}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {chartMode === 'inflation' && (
                <>
                  {/* Nominal Path (background) */}
                  <path d={paths.gainAreaPath} fill="url(#stocksGradient)" />
                  {/* Real Purchasing Power (inflation-deflated) */}
                  <path d={paths.realAreaPath} fill="url(#realGradient)" />
                  <path
                    d={paths.realTopLine}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </>
          )}

          {/* Vertical X-Axis Markers for full years */}
          {pointsWithCoords.map((p) => {
            const isFullYear = p.point.month % 12 === 0;
            if (!isFullYear && p.point.month !== pointsWithCoords[pointsWithCoords.length - 1].point.month) {
              return null;
            }
            const yearNum = Math.round(p.point.month / 12);
            return (
              <g key={`xmarker-${p.point.month}`}>
                <line
                  x1={p.x}
                  y1={plotYBottom}
                  x2={p.x}
                  y2={plotYBottom + 6}
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <text
                  x={p.x}
                  y={plotYBottom + 22}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {yearNum === 0 ? 'Start' : `${yearNum}r`}
                </text>
              </g>
            );
          })}

          {/* Interactive Hover Crosshair & Dots */}
          {activeCoord && hoverIndex !== null && (
            <g>
              {/* Vertical guideline */}
              <line
                x1={activeCoord.x}
                y1={MARGIN_TOP}
                x2={activeCoord.x}
                y2={plotYBottom}
                stroke="#818CF8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {chartMode === 'assets' && (
                <>
                  {/* Total dot */}
                  <circle cx={activeCoord.x} cy={activeCoord.yTotal} r="5.5" fill="#10B981" stroke="#0B0E14" strokeWidth="2.5" />
                  {/* Savings dot */}
                  <circle cx={activeCoord.x} cy={activeCoord.ySavings} r="4.5" fill="#0EA5E9" stroke="#0B0E14" strokeWidth="2" />
                </>
              )}

              {chartMode === 'growth' && (
                <>
                  {/* Nominal dot */}
                  <circle cx={activeCoord.x} cy={activeCoord.yNominal} r="5.5" fill="#10B981" stroke="#0B0E14" strokeWidth="2.5" />
                  {/* Principal dot */}
                  <circle cx={activeCoord.x} cy={activeCoord.yPrincipal} r="4.5" fill="#6366F1" stroke="#0B0E14" strokeWidth="2" />
                </>
              )}

              {chartMode === 'inflation' && (
                <>
                  <circle cx={activeCoord.x} cy={activeCoord.yNominal} r="5" fill="#10B981" stroke="#0B0E14" strokeWidth="2" />
                  <circle cx={activeCoord.x} cy={activeCoord.yReal} r="5" fill="#F59E0B" stroke="#0B0E14" strokeWidth="2" />
                </>
              )}

              {/* Dispersion Upper & Lower dots on crosshair */}
              {showDispersion && activeCoord.yVarianceUpper !== undefined && activeCoord.yVarianceLower !== undefined && (
                <>
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.yVarianceUpper}
                    r="3.5"
                    fill="#818CF8"
                    stroke="#0B0E14"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.yVarianceLower}
                    r="3.5"
                    fill="#818CF8"
                    stroke="#0B0E14"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </g>
          )}
        </svg>

        {/* Legend pills under chart */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 px-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {chartMode === 'assets' ? (
              <>
                <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span>Investice (Akcie & ETF)</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-sky-400">
                  <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
                  <span>Spořící účet (se stropem 500k)</span>
                </div>
              </>
            ) : chartMode === 'growth' ? (
              <>
                <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span>Složený úrok & zisk</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-indigo-400">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                  <span>Vlastní vložený kapitál</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span>Nominální majetek</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-amber-400">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span>Reálná kupní síla (po inflaci 2,5 % p.a.)</span>
                </div>
              </>
            )}

            {/* Dispersion Corridor Legend Pill */}
            {paths?.hasVariance && showDispersion && (
              <div className="flex items-center gap-1.5 font-medium text-indigo-400 border-l border-slate-800 pl-3">
                <span className="w-3.5 h-2 rounded border border-dashed border-indigo-400 bg-indigo-500/20 inline-block" />
                <span>Pásmo rozptylu {dispersionPct !== undefined ? `(±${dispersionPct} % p.a.)` : ''}</span>
              </div>
            )}
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {hoverIndex !== null ? 'Přejetím myši procházíte měsíce' : 'Zobrazen koncový stav horizontu'}
          </span>
        </div>
      </div>

      {/* Floating Detailed Snapshot Card for Active / Hovered Point */}
      {activeCoord && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 shadow-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 font-mono text-xs">
          {/* 1. Období a celková hodnota */}
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">
              {activeCoord.point.month === 0
                ? 'Výchozí stav'
                : `Rok ${Math.floor(activeCoord.point.month / 12)}, Měsíc ${activeCoord.point.month}`}
            </div>
            <div className="text-lg font-bold text-white">
              <MoneyDisplay amount={activeCoord.point.nominalValue} />
            </div>
            <div className="text-[10px] text-slate-400">
              Kupní síla: <MoneyDisplay amount={activeCoord.point.realValue} className="text-slate-300 font-semibold" />
            </div>
          </div>

          {/* 2. Akcie & ETF */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Akcie & ETF:</span>
            </div>
            <div className="text-base font-bold text-emerald-400">
              <MoneyDisplay amount={activeCoord.point.stocksValue} />
            </div>
            <div className="text-[10px] text-slate-400">
              Vklad: <MoneyDisplay amount={activeCoord.point.stocksPrincipalInvested} /> / Zisk: +<MoneyDisplay amount={activeCoord.point.stocksCompoundGain} className="text-emerald-300 font-semibold" />
            </div>
          </div>

          {/* 3. Spořící účet */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-sky-400 font-semibold flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              <span>Spořící účet:</span>
            </div>
            <div className="text-base font-bold text-sky-400">
              <MoneyDisplay amount={activeCoord.point.savingsValue} />
            </div>
            <div className="text-[10px] text-slate-400">
              Vklad: <MoneyDisplay amount={activeCoord.point.savingsPrincipalInvested} /> / Úrok: +<MoneyDisplay amount={activeCoord.point.savingsInterestGain} className="text-sky-300 font-semibold" />
            </div>
            {activeCoord.point.savingsSpilloverToStocks !== undefined && activeCoord.point.savingsSpilloverToStocks > 0 && (
              <div className="text-[10px] text-amber-300 pt-0.5 font-semibold">
                Přelito do akcií: +<MoneyDisplay amount={activeCoord.point.savingsSpilloverToStocks} />
              </div>
            )}
          </div>

          {/* 4. Složený zisk celkem */}
          <div className="border-l border-slate-800/80 pl-3">
            <div className="text-[11px] text-slate-400 mb-0.5">Složený úrok (zisk celkem):</div>
            <div className="text-base font-bold text-emerald-300">
              +<MoneyDisplay amount={activeCoord.point.compoundInterestGain} />
            </div>
            <div className="text-[10px] text-slate-400">
              Vloženo: <MoneyDisplay amount={activeCoord.point.principalInvested} /> (
              {activeCoord.point.principalInvested > 0
                ? `${(activeCoord.point.nominalValue / activeCoord.point.principalInvested).toFixed(2)}x`
                : '1.0x'}
              )
            </div>
          </div>

          {/* 5. Rozptyl / Pásmo volatility */}
          {activeCoord.point.varianceUpperValue !== undefined && activeCoord.point.varianceLowerValue !== undefined && (
            <div className="border-l border-indigo-500/30 pl-3">
              <div className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                <span>Rozptyl {activeCoord.point.dispersionPercent !== undefined ? `(±${activeCoord.point.dispersionPercent} %)` : ''}:</span>
              </div>
              <div className="text-xs font-bold text-indigo-300">
                <MoneyDisplay amount={activeCoord.point.varianceLowerValue} />
                <span className="text-slate-500 font-normal mx-1">–</span>
                <MoneyDisplay amount={activeCoord.point.varianceUpperValue} />
              </div>
              <div className="text-[10px] text-slate-400 pt-0.5">
                Koridor volatility zhodnocení akcií
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
