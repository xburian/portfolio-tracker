import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Flame,
  TrendingDown,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Zap,
} from 'lucide-react';
import { DecumulationConfig, DecumulationPoint } from '@/types/budget';
import { FireService } from '@/lib/services/fireService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

interface DecumulationSimulatorProps {
  initialCapital: number;
  initialCashCushion: number;
  monthlyExpense: number;
}

export const DecumulationSimulator: React.FC<DecumulationSimulatorProps> = ({
  initialCapital,
  initialCashCushion,
  monthlyExpense,
}) => {
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const formatCurrency = useCurrencyStore((s) => s.formatCurrency);

  const [startingWealth, setStartingWealth] = useState<number>(initialCapital > 0 ? initialCapital : 15_000_000);
  const [startingCash, setStartingCash] = useState<number>(initialCashCushion > 0 ? initialCashCushion : 500_000);
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState<number>(monthlyExpense > 0 ? monthlyExpense : 50_000);
  const [annualReturnPct, setAnnualReturnPct] = useState<number>(7.0);
  const [annualInflationPct, setAnnualInflationPct] = useState<number>(2.5);
  const [horizonYears, setHorizonYears] = useState<number>(30);
  const [stressTestEnabled, setStressTestEnabled] = useState<boolean>(false);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const decumulationData: DecumulationPoint[] = useMemo(() => {
    return FireService.simulateDecumulation({
      initialPortfolioCZK: startingWealth,
      initialCashCushionCZK: startingCash,
      monthlyWithdrawalCZK: monthlyWithdrawal,
      annualInflationPct,
      annualNominalReturnPct: annualReturnPct,
      horizonYears,
      stressTestEnabled,
    });
  }, [
    startingWealth,
    startingCash,
    monthlyWithdrawal,
    annualInflationPct,
    annualReturnPct,
    horizonYears,
    stressTestEnabled,
  ]);

  const finalPoint = decumulationData[decumulationData.length - 1];
  const isSurvived = finalPoint && !finalPoint.isBankrupt && finalPoint.totalWealthCZK > 0;

  // Chart coordinate mapping
  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    startingWealth + startingCash,
    ...decumulationData.map((d) => d.totalWealthCZK)
  ) * 1.15;

  const pointsCount = decumulationData.length;
  const getX = (idx: number) => padding.left + (idx / Math.max(1, pointsCount - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - (Math.max(0, val) / (maxVal || 1)) * chartH;

  const pathTotalWealth = decumulationData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.totalWealthCZK)}`)
    .join(' ');

  const pathRealWealth = decumulationData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.realPurchasingPowerWealthCZK)}`)
    .join(' ');

  const areaTotalWealth = `${pathTotalWealth} L ${getX(pointsCount - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  const hoveredPoint = hoverIndex !== null ? decumulationData[hoverIndex] : null;

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500/20 to-indigo-500/20 text-rose-400 border border-rose-500/30">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Simulátor čerpání renty (Post-FIRE Decumulation)</span>
                {stressTestEnabled && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                    ⚠️ Krizový test aktivní (-25% R1, -15% R2)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Ověřte, zda vaše portfolio přežije 30–50 let pravidelné renty valorizované o inflaci i těžké propady trhu
              </p>
            </div>
          </div>
        </div>

        {/* Horizon selector buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {[20, 30, 40, 50].map((yr) => (
            <button
              key={yr}
              onClick={() => setHorizonYears(yr)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                horizonYears === yr
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {yr} let
            </button>
          ))}
        </div>
      </div>

      {/* 2. Ovládací parametry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
        {/* Počáteční portfolio */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Výchozí portfolio v akciích:</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={startingWealth}
              onChange={(e) => setStartingWealth(parseInt(e.target.value, 10) || 0)}
              step="500000"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Hotovostní polštář */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Hotovostní polštář (Spořák):</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={startingCash}
              onChange={(e) => setStartingCash(parseInt(e.target.value, 10) || 0)}
              step="100000"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-sky-400 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Měsíční čistá renta */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Měsíční renta (dnešní hodnota):</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={monthlyWithdrawal}
              onChange={(e) => setMonthlyWithdrawal(parseInt(e.target.value, 10) || 0)}
              step="5000"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Roční výnos & inflace */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Výnos trhu vs Inflace:</span>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">Výnos:</span>
              <input
                type="number"
                value={annualReturnPct}
                onChange={(e) => setAnnualReturnPct(parseFloat(e.target.value) || 0)}
                step="0.5"
                className="w-14 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-bold text-white text-center"
              />
              <span className="text-slate-400 text-[10px]">%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">Inflace:</span>
              <input
                type="number"
                value={annualInflationPct}
                onChange={(e) => setAnnualInflationPct(parseFloat(e.target.value) || 0)}
                step="0.5"
                className="w-14 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-bold text-white text-center"
              />
              <span className="text-slate-400 text-[10px]">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sequence of Returns Stress Test Toggle */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={stressTestEnabled}
            onChange={(e) => setStressTestEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-0"
          />
          <div>
            <span className="text-xs font-bold text-white block">
              Aktivovat krizový test: Sequence of Returns Risk (SORR)
            </span>
            <span className="text-[11px] text-slate-400 block">
              Simuluje propad akciového trhu o <strong>-25 % v 1. roce</strong> a <strong>-15 % v 2. roce</strong> důchodu. Ukazuje, jak hotovostní polštář zabrání odprodeji akcií ve dně.
            </span>
          </div>
        </label>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
            isSurvived
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {isSurvived ? '✓ Portfolio přežilo celých ' + horizonYears + ' let' : '⚠️ Portfolio vyčerpáno předčasně!'}
          </span>
        </div>
      </div>

      {/* 4. Interaktivní graf vývoje bohatství při čerpání */}
      <div className="relative p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-400 inline-block" />
              <span>Nominální majetek</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-400 inline-block border-t border-dashed" />
              <span>Reálná hodnota (po inflaci)</span>
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Horizont: {horizonYears} let
          </span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartH * (1 - pct);
            const val = maxVal * pct;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="0.5"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {(val / 1_000_000).toFixed(1)}M
                </text>
              </g>
            );
          })}

          {/* Zero threshold line */}
          <line
            x1={padding.left}
            y1={getY(0)}
            x2={width - padding.right}
            y2={getY(0)}
            stroke="#64748B"
            strokeWidth="1"
          />

          {/* Shaded Area */}
          <path d={areaTotalWealth} fill="url(#wealthGradient)" />

          {/* Real wealth line (dashed) */}
          <path
            d={pathRealWealth}
            fill="none"
            stroke="#818CF8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Nominal wealth line */}
          <path
            d={pathTotalWealth}
            fill="none"
            stroke="#F43F5E"
            strokeWidth="2.5"
          />

          {/* Data points & interaction columns */}
          {decumulationData.map((d, i) => {
            const x = getX(i);
            const y = getY(d.totalWealthCZK);
            const isHovered = hoverIndex === i;

            return (
              <g key={i}>
                {/* Invisible hover slice */}
                <rect
                  x={x - chartW / (pointsCount * 2)}
                  y={padding.top}
                  width={chartW / pointsCount}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  className="cursor-crosshair"
                />

                {isHovered && (
                  <>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + chartH}
                      stroke="#94A3B8"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx={x} cy={y} r="5" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="2" />
                  </>
                )}

                {/* X axis labels for intervals */}
                {(d.year % 5 === 0 || i === pointsCount - 1) && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {d.year === 0 ? 'Start' : `R${d.year}`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover detail tooltip */}
        {hoveredPoint && (
          <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-400">Období: </span>
              <strong className="text-white">{hoveredPoint.dateLabel} (Měsíc {hoveredPoint.month})</strong>
            </div>
            <div>
              <span className="text-slate-400">Celkový majetek: </span>
              <strong className="text-rose-400"><MoneyDisplay amount={hoveredPoint.totalWealthCZK} /></strong>
            </div>
            <div>
              <span className="text-slate-400">Reálná kupní síla: </span>
              <strong className="text-indigo-300"><MoneyDisplay amount={hoveredPoint.realPurchasingPowerWealthCZK} /></strong>
            </div>
            <div>
              <span className="text-slate-400">Měsíční renta po inflaci: </span>
              <strong className="text-emerald-400"><MoneyDisplay amount={hoveredPoint.monthlyGrossWithdrawalCZK} /></strong>
            </div>
            <div>
              <span className="text-slate-400">Vybráno kumulativně: </span>
              <strong className="text-slate-200"><MoneyDisplay amount={hoveredPoint.cumulativeWithdrawnCZK} /></strong>
            </div>
          </div>
        )}
      </div>

      {/* 5. Shrnutí výsledku */}
      {finalPoint && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Konečný zůstatek za {horizonYears} let:</span>
            <MoneyDisplay
              amount={finalPoint.totalWealthCZK}
              className={`text-xl font-bold block mt-1 ${isSurvived ? 'text-white' : 'text-rose-400'}`}
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Reálná kupní síla: <MoneyDisplay amount={finalPoint.realPurchasingPowerWealthCZK} className="text-slate-300" />
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Celkem vyplaceno na rentě:</span>
            <MoneyDisplay
              amount={finalPoint.cumulativeWithdrawnCZK}
              className="text-xl font-bold text-emerald-400 block mt-1"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Z původního vkladu <MoneyDisplay amount={startingWealth + startingCash} />
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 block">Zhodnocení stability renty:</span>
            <div className="text-sm font-bold text-white mt-1">
              {isSurvived ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Plně udržitelná renta</span>
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Riziko vyčerpání</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {isSurvived
                ? 'Kapitál vydržel generovat rentu po celých ' + horizonYears + ' let bez bankrotu.'
                : 'Doporučujeme snížit měsíční rentu nebo navýšit hotovostní polštář.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
