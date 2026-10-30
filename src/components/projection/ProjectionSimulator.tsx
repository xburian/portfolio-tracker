import React, { useState, useMemo } from 'react';
import { Sparkles, TrendingUp, Compass, Flame } from 'lucide-react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FireService } from '@/lib/services/fireService';
import { ProjectionChart } from './ProjectionChart';
import { MilestoneList } from './MilestoneList';

interface ProjectionSimulatorProps {
  valuations: ValuationDetail[];
}

export const ProjectionSimulator: React.FC<ProjectionSimulatorProps> = ({ valuations }) => {
  const currentTotal = useMemo(() => {
    return valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
  }, [valuations]);

  // Sliders state
  const [initialCapital, setInitialCapital] = useState<number>(currentTotal || 100000);
  const [monthlyDca, setMonthlyDca] = useState<number>(15000);
  const [annualReturnPct, setAnnualReturnPct] = useState<number>(8.0);
  const [horizonYears, setHorizonYears] = useState<number>(10);
  const [desiredMonthlyExpense, setDesiredMonthlyExpense] = useState<number>(50000);

  // Sync initialCapital with portfolio total when loaded
  React.useEffect(() => {
    if (currentTotal > 0) {
      setInitialCapital(Math.round(currentTotal));
    }
  }, [currentTotal]);

  const projectionData = useMemo(() => {
    return FireService.generateProjection(
      initialCapital,
      monthlyDca,
      annualReturnPct / 100,
      0.025,
      horizonYears
    );
  }, [initialCapital, monthlyDca, annualReturnPct, horizonYears]);

  const milestones = useMemo(() => {
    return FireService.getMilestones(
      initialCapital,
      monthlyDca,
      annualReturnPct / 100,
      [1_000_000, 3_000_000, 5_000_000, 10_000_000]
    );
  }, [initialCapital, monthlyDca, annualReturnPct]);

  const fireResult = useMemo(() => {
    return FireService.calculateFIRE(
      initialCapital,
      monthlyDca,
      annualReturnPct / 100,
      desiredMonthlyExpense,
      true // Accumulating ETFs tax-exempt after 3 years
    );
  }, [initialCapital, monthlyDca, annualReturnPct, desiredMonthlyExpense]);

  const finalPoint = projectionData[projectionData.length - 1];

  return (
    <div className="flex flex-col gap-6">
      {/* Simulator Control Deck */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Simulátor budoucího majetku & FIRE</span>
            </h3>
            <p className="text-xs text-slate-400">
              Odhad hodnoty portfolia za 5 až 30 let s měsíčním vkladem (DCA) a složeným úročením
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[5, 10, 15, 20, 25, 30].map((yr) => (
              <button
                key={yr}
                onClick={() => setHorizonYears(yr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                  horizonYears === yr
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {yr} let
              </button>
            ))}
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-slate-800/60">
          {/* 1. Očekávaný roční výnos (CAGR) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Očekávaný roční výnos (CAGR):</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">{annualReturnPct.toFixed(1)}% p.a.</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={annualReturnPct}
              onChange={(e) => setAnnualReturnPct(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Konzervativní (5%)</span>
              <span>S&P 500 / Trh (8–10%)</span>
              <span>Optimistický (12%+)</span>
            </div>
          </div>

          {/* 2. Měsíční vklad (DCA) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Pravidelný měsíční vklad (DCA):</span>
              <MoneyDisplay amount={monthlyDca} className="font-mono font-bold text-emerald-400 text-sm" />
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={monthlyDca}
              onChange={(e) => setMonthlyDca(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 Kč</span>
              <span>15 000 Kč</span>
              <span>50 000 Kč/měs</span>
            </div>
          </div>

          {/* 3. Počáteční kapitál */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Počáteční hodnota portfolia:</span>
              <MoneyDisplay amount={initialCapital} className="font-mono font-bold text-slate-200 text-sm" />
            </div>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-semibold text-slate-200 text-right focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Milestone Cards */}
        <div className="pt-2">
          <MilestoneList milestones={milestones} currentValue={initialCapital} />
        </div>

        {/* Main Growth Chart */}
        <div className="pt-2">
          <ProjectionChart data={projectionData} />
        </div>

        {/* Projection KPI summary row */}
        {finalPoint && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-mono">Odhad za {horizonYears} let</span>
              <MoneyDisplay amount={finalPoint.nominalValue} className="text-xl sm:text-2xl font-bold text-emerald-400 block mt-1" />
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Po inflaci: <MoneyDisplay amount={finalPoint.realValue} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-mono">Vlastní vklad vs. Složený zisk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-indigo-300">Vklad:</span>
                <MoneyDisplay amount={finalPoint.principalInvested} className="font-mono font-semibold text-slate-300 text-sm" />
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xs text-emerald-400">Zisk:</span>
                <MoneyDisplay amount={finalPoint.compoundInterestGain} className="font-mono font-bold text-emerald-400 text-sm" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-mono">Zhodnocení vkladu</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono mt-1">
                {finalPoint.principalInvested > 0
                  ? `${(finalPoint.nominalValue / finalPoint.principalInvested).toFixed(2)}x`
                  : '1.0x'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Násobek vložených peněz
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FIRE (Financial Independence) Box */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-start gap-3 max-w-xl">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Kalkulačka finanční svobody (FIRE)</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Pravidlo 4 % bezpečného výběru (Trinity Study). Díky českému 3letému časovému testu jsou akumulační ETF osvobozena od daně z příjmu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div>
            <span className="text-[10px] font-mono text-slate-400 block">Požadovaná měsíční renta:</span>
            <input
              type="number"
              value={desiredMonthlyExpense}
              onChange={(e) => setDesiredMonthlyExpense(parseInt(e.target.value, 10) || 0)}
              className="w-36 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-100 text-right focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right font-mono">
            <span className="text-[10px] text-slate-400 block">Cílové portfolio:</span>
            <MoneyDisplay amount={fireResult.firePortfolioTarget} className="text-sm font-bold text-rose-400" />
            <div className="text-[10px] text-slate-500 mt-0.5">
              Za {fireResult.yearsToFIRE} let ({fireResult.fireDate})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
