import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, TrendingUp, Compass, Flame, Wallet, RefreshCw, Zap } from 'lucide-react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FireService } from '@/lib/services/fireService';
import { useBudgetStore } from '@/lib/stores/useBudgetStore';
import { ProjectionChart } from './ProjectionChart';
import { MilestoneList } from './MilestoneList';

interface ProjectionSimulatorProps {
  valuations: ValuationDetail[];
}

export const ProjectionSimulator: React.FC<ProjectionSimulatorProps> = ({ valuations }) => {
  const currentTotal = useMemo(() => {
    return valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
  }, [valuations]);

  const getCashflowSnapshot = useBudgetStore((s) => s.getCashflowSnapshot);
  const salaryConfig = useBudgetStore((s) => s.salaryConfig);
  const cashflow = getCashflowSnapshot();

  // Sliders state
  const [initialCapital, setInitialCapital] = useState<number>(currentTotal || 100000);
  const [monthlyDca, setMonthlyDca] = useState<number>(cashflow.netInvestableCapacityCZK > 0 ? cashflow.netInvestableCapacityCZK : 25000);
  const [annualReturnPct, setAnnualReturnPct] = useState<number>(10.0);
  const [horizonYears, setHorizonYears] = useState<number>(5);
  const [desiredMonthlyExpense, setDesiredMonthlyExpense] = useState<number>(50000);

  // Advanced toggles
  const [includeCareerEscalator, setIncludeCareerEscalator] = useState<boolean>(true);
  const [dripReinvestment, setDripReinvestment] = useState<boolean>(true);

  // Sync initialCapital with portfolio total when loaded
  useEffect(() => {
    if (currentTotal > 0) {
      setInitialCapital(Math.round(currentTotal));
    }
  }, [currentTotal]);

  // Handle macro scenario presets
  const applyScenario = (cagr: number, name: string) => {
    setAnnualReturnPct(cagr);
  };

  const projectionData = useMemo(() => {
    // If career escalator is enabled, compute effective monthly contribution accounting for salary growth
    let effectiveDca = monthlyDca;
    if (includeCareerEscalator && salaryConfig.annualIncreasePercentage > 0) {
      // Average DCA over horizon with salary escalator
      const growthFactor = Math.pow(1 + salaryConfig.annualIncreasePercentage / 100, horizonYears / 2);
      effectiveDca = Math.round(monthlyDca * growthFactor);
    }

    const dividendBonus = dripReinvestment ? 0.017 : 0; // ~1.7% net dividend reinvestment

    return FireService.generateProjection(
      initialCapital,
      effectiveDca,
      (annualReturnPct / 100) + dividendBonus,
      0.025,
      horizonYears
    );
  }, [initialCapital, monthlyDca, annualReturnPct, horizonYears, includeCareerEscalator, dripReinvestment, salaryConfig]);

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
              <span>Vícehorizontový simulátor bohatství & FIRE</span>
            </h3>
            <p className="text-xs text-slate-400">
              Propojení čisté mzdy, kariérního růstu, měsíčních úspor a složeného úročení akcií
            </p>
          </div>

          {/* Horizon selector buttons */}
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            {[1, 3, 5, 10, 20, 30].map((yr) => (
              <button
                key={yr}
                onClick={() => setHorizonYears(yr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  horizonYears === yr
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {yr} {yr === 1 ? 'rok' : yr < 5 ? 'roky' : 'let'}
              </button>
            ))}
          </div>
        </div>

        {/* Macro Scenarios Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Rychlé makro scénáře:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyScenario(6.0, 'Konzervativní')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                annualReturnPct === 6.0
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Konzervativní (6 % p.a.)
            </button>
            <button
              onClick={() => applyScenario(10.0, 'Realistický')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                annualReturnPct === 10.0
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-semibold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Realistický trh (10 % p.a.)
            </button>
            <button
              onClick={() => applyScenario(14.0, 'Optimistický')}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                annualReturnPct === 14.0
                  ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-semibold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Optimistický (14 % p.a.)
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-slate-800/60">
          {/* 1. Očekávaný roční výnos (CAGR) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Výnos akcií (CAGR):</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">{annualReturnPct.toFixed(1)}% p.a.</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="18.0"
              step="0.5"
              value={annualReturnPct}
              onChange={(e) => setAnnualReturnPct(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Dluhopisy (3%)</span>
              <span>S&P 500 (10%)</span>
              <span>Růstové akcie (15%+)</span>
            </div>
          </div>

          {/* 2. Měsíční vklad (DCA) s napojením na rozpočet */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Měsíční vklad (DCA):</span>
                {cashflow.netInvestableCapacityCZK > 0 && (
                  <button
                    onClick={() => setMonthlyDca(cashflow.netInvestableCapacityCZK)}
                    title="Nastavit podle volné investiční kapacity z rozpočtu"
                    className="p-0.5 rounded text-indigo-400 hover:text-indigo-300"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
              <MoneyDisplay amount={monthlyDca} className="font-mono font-bold text-emerald-400 text-sm" />
            </div>
            <input
              type="range"
              min="0"
              max="100000"
              step="2000"
              value={monthlyDca}
              onChange={(e) => setMonthlyDca(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 Kč</span>
              <span className="text-emerald-400/80 font-medium">Z rozpočtu: {Math.round(cashflow.netInvestableCapacityCZK / 1000)}k</span>
              <span>100 000 Kč/měs</span>
            </div>
          </div>

          {/* 3. Počáteční kapitál */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Současná hodnota majetku:</span>
              <MoneyDisplay amount={initialCapital} className="font-mono font-bold text-slate-200 text-sm" />
            </div>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-semibold text-slate-200 text-right focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setInitialCapital(Math.round(currentTotal))}
                className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
              >
                Resetovat na tržní hodnotu ({Math.round(currentTotal).toLocaleString()} Kč)
              </button>
            </div>
          </div>
        </div>

        {/* Kariérní růst & DRIP volby */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/60 text-xs">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-all">
            <input
              type="checkbox"
              checked={includeCareerEscalator}
              onChange={(e) => setIncludeCareerEscalator(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Kariérní eskalátor (+{salaryConfig.annualIncreasePercentage}% mzdy ročně)</span>
              <span className="text-[11px] text-slate-400">Automaticky navyšuje měsíční vklad s každým rokem zaměstnání</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-all">
            <input
              type="checkbox"
              checked={dripReinvestment}
              onChange={(e) => setDripReinvestment(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Reinvestování dividend (DRIP +1.7 % p.a.)</span>
              <span className="text-[11px] text-slate-400">Vyplacené dividendy se automaticky přikupují zpět do portfolia</span>
            </div>
          </label>
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
              <span className="text-[11px] text-slate-400 font-mono">Odhad za {horizonYears} {horizonYears === 1 ? 'rok' : horizonYears < 5 ? 'roky' : 'let'}</span>
              <MoneyDisplay amount={finalPoint.nominalValue} className="text-xl sm:text-2xl font-bold text-emerald-400 block mt-1" />
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Po inflaci (reálná kupní síla): <MoneyDisplay amount={finalPoint.realValue} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-mono">Vlastní vklad vs. Složený zisk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-indigo-300">Vlastní vklady z platu:</span>
                <MoneyDisplay amount={finalPoint.principalInvested} className="font-mono font-semibold text-slate-300 text-sm" />
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xs text-emerald-400">Zisk ze složeného úročení:</span>
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
