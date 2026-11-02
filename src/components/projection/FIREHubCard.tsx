import React, { useState, useMemo } from 'react';
import {
  Flame,
  ShieldCheck,
  Zap,
  Coffee,
  Ship,
  Sparkles,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  DollarSign,
  HeartHandshake,
} from 'lucide-react';
import { ComprehensiveFIREResult, FIRETierDetail } from '@/types/budget';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FireService, ProjectionDataPoint } from '@/lib/services/fireService';

interface FIREHubCardProps {
  currentPortfolioValue: number;
  monthlyDCA: number;
  annualNominalReturn: number;
  essentialMonthlyExpenses: number;
  totalMonthlyExpenses: number;
  liquidCashAndSavings: number;
  projectionData?: ProjectionDataPoint[];
}

export const FIREHubCard: React.FC<FIREHubCardProps> = ({
  currentPortfolioValue,
  monthlyDCA,
  annualNominalReturn,
  essentialMonthlyExpenses,
  totalMonthlyExpenses,
  liquidCashAndSavings,
  projectionData = [],
}) => {
  // SWR slider state (default 3.5% modern safe withdrawal rate)
  const [swrPct, setSwrPct] = useState<number>(3.5);

  // Barista FIRE part-time income state
  const [baristaIncome, setBaristaIncome] = useState<number>(20000);

  // Fat FIRE buffer percent
  const [fatBufferPct, setFatBufferPct] = useState<number>(35);

  // Coast FIRE age inputs
  const [currentAge, setCurrentAge] = useState<number>(32);
  const [targetRetirementAge, setTargetRetirementAge] = useState<number>(60);

  // Active tier tab for drill-down
  const [activeTier, setActiveTier] = useState<'lean' | 'standard' | 'fat' | 'barista' | 'coast'>('standard');

  const comprehensiveFIRE: ComprehensiveFIREResult = useMemo(() => {
    return FireService.calculateComprehensiveFIRE({
      currentPortfolioValue,
      monthlyDCA,
      annualNominalReturn,
      swrAnnualRatePct: swrPct,
      essentialMonthlyExpenses: essentialMonthlyExpenses > 0 ? essentialMonthlyExpenses : 30000,
      totalMonthlyExpenses: totalMonthlyExpenses > 0 ? totalMonthlyExpenses : 50000,
      baristaPartTimeIncome: baristaIncome,
      fatBufferPct,
      currentAge,
      targetRetirementAge,
      liquidCashAndSavings,
      projectionPoints: projectionData,
      isTaxExemptAccumulating: true, // § 4 ZDP
    });
  }, [
    currentPortfolioValue,
    monthlyDCA,
    annualNominalReturn,
    swrPct,
    essentialMonthlyExpenses,
    totalMonthlyExpenses,
    baristaIncome,
    fatBufferPct,
    currentAge,
    targetRetirementAge,
    liquidCashAndSavings,
    projectionData,
  ]);

  const { tiers, coastFIRE, crossoverPoint, liquidRunway } = comprehensiveFIRE;

  const renderTierCard = (
    tier: FIRETierDetail,
    icon: React.ElementType,
    badgeColor: string,
    borderColor: string,
    isSelected: boolean
  ) => {
    const Icon = icon;
    return (
      <div
        onClick={() => setActiveTier(tier.category)}
        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
          isSelected
            ? `${borderColor} bg-slate-900/90 shadow-lg scale-[1.01]`
            : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/70 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-xl ${badgeColor}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white tracking-tight">{tier.name}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-400">
            {tier.progressPercentage.toFixed(1)} %
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(2, tier.progressPercentage))}%` }}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-slate-400 font-mono">Cílové portfolio:</span>
            <MoneyDisplay amount={tier.targetPortfolioCZK} className="text-xs font-bold text-slate-100 font-mono" />
          </div>
          <div className="flex items-baseline justify-between text-[10px] text-slate-400 font-mono">
            <span>Renta měsíčně:</span>
            <MoneyDisplay amount={tier.monthlyExpenseCZK} className="text-slate-300 font-semibold" />
          </div>
          <div className="flex items-baseline justify-between text-[10px] pt-1.5 border-t border-slate-800/60 font-mono">
            <span className="text-slate-500">Čas k dosažení:</span>
            <span className="font-bold text-emerald-400">
              {tier.reachable ? `Za ${tier.yearsToFIRE} let (${tier.fireDate})` : 'Nedosažitelné'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      {/* 1. Header & SWR Control Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 text-rose-400 border border-rose-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>FIRE Command Center & Úrovně svobody</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  § 4 ZDP 0% daň
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Modelování 5 stupňů finanční nezávislosti, bezpečné míry výběru (SWR) a bodu zlomu
              </p>
            </div>
          </div>
        </div>

        {/* SWR Selector */}
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-semibold text-slate-300 ml-1">SWR (Safe Withdrawal Rate):</span>
          {[3.0, 3.25, 3.5, 4.0, 4.5].map((rate) => (
            <button
              key={rate}
              onClick={() => setSwrPct(rate)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                swrPct === rate
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {rate.toFixed(rate === 3.25 ? 2 : 1)} %
              {rate === 3.5 ? ' (FIRE)' : rate === 4.0 ? ' (Trinity)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Crossover Point & Liquid Runway Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bod zlomu (Crossover Point) */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/30 to-slate-900/60 border border-indigo-500/30 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Bod zlomu (Crossover Point)</span>
            </div>
            {crossoverPoint.hasReached ? (
              <div>
                <div className="text-lg font-bold text-white mt-1">
                  Dosažen v roce {crossoverPoint.crossoverDate}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Měsíční pasivní výnos <strong className="text-emerald-400">+{crossoverPoint.monthlyPassiveGainCZK?.toLocaleString()} Kč</strong> přeroste životní výdaje!
                </p>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-slate-300 mt-1">
                  V rámci zvoleného horizontu zatím nepřekročí výdaje
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Zvyšte investiční horizont v simulátoru nebo navyšte měsíční vklad.
                </p>
              </div>
            )}
          </div>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Likvidní polštář & Runway */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/60 to-emerald-950/20 border border-emerald-500/30 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Finanční polštář & Runway</span>
            </div>
            <div className="text-lg font-bold text-white mt-1">
              {liquidRunway.essentialRunwayMonths} měsíců přežití
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Zůstatek hotovosti <strong className="text-white">{liquidRunway.liquidCashAndSavingsCZK.toLocaleString()} Kč</strong> pokryje {liquidRunway.essentialRunwayMonths} měsíců nutných výdajů ({liquidRunway.totalRunwayMonths} měsíců plného životního stylu).
            </p>
          </div>
          <div className={`p-2 rounded-xl border shrink-0 ${
            liquidRunway.runwayStatus === 'exceptional'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Multi-tier FIRE Matrix Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lean FIRE */}
        {renderTierCard(
          tiers.lean,
          ShieldCheck,
          'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
          'border-cyan-500/60 ring-1 ring-cyan-500/40',
          activeTier === 'lean'
        )}

        {/* Standard FIRE */}
        {renderTierCard(
          tiers.standard,
          Flame,
          'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          'border-rose-500/60 ring-1 ring-rose-500/40',
          activeTier === 'standard'
        )}

        {/* Fat FIRE */}
        {renderTierCard(
          tiers.fat,
          Ship,
          'bg-amber-500/20 text-amber-400 border border-amber-500/30',
          'border-amber-500/60 ring-1 ring-amber-500/40',
          activeTier === 'fat'
        )}

        {/* Barista FIRE */}
        {renderTierCard(
          tiers.barista,
          Coffee,
          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          'border-emerald-500/60 ring-1 ring-emerald-500/40',
          activeTier === 'barista'
        )}
      </div>

      {/* 4. Coast FIRE & Barista Customizer Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        {/* Coast FIRE Karta */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Coast FIRE (Pasivní dorůstání)</h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              coastFIRE.isCoastingAchieved
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
            }`}>
              {coastFIRE.isCoastingAchieved ? '✓ Coasting splněn!' : 'Na cestě ke Coast FIRE'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Množství kapitálu potřebné <strong>DNES</strong>, aby složené úročení samo bez jediného dalšího vkladu dorostlo k plnému Standard FIRE v cílovém věku.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Věk: Nyní vs Odchod</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={currentAge}
                  onChange={(e) => setCurrentAge(parseInt(e.target.value, 10) || 30)}
                  className="w-12 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-center font-bold text-white"
                />
                <span className="text-slate-500">→</span>
                <input
                  type="number"
                  value={targetRetirementAge}
                  onChange={(e) => setTargetRetirementAge(parseInt(e.target.value, 10) || 60)}
                  className="w-12 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-center font-bold text-white"
                />
                <span className="text-slate-400 text-[10px]">({coastFIRE.yearsToRetirement} let)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Potřebný kapitál dnes:</span>
              <MoneyDisplay amount={coastFIRE.requiredCapitalTodayCZK} className="text-sm font-bold text-white block mt-1" />
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <span>Rozdíl oproti dnešnímu stavu:</span>
            <span className={coastFIRE.surplusOrShortfallCZK >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {coastFIRE.surplusOrShortfallCZK >= 0 ? '+' : ''}
              <MoneyDisplay amount={coastFIRE.surplusOrShortfallCZK} />
            </span>
          </div>
        </div>

        {/* Barista FIRE Simulátor */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Coffee className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Barista FIRE (Částečný úvazek / Freelance)</h4>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {baristaIncome.toLocaleString()} Kč / měs
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Nemusíte čekat na miliony pro úplnou rentu. Nastavte si příjem z příjemné práce na částečný úvazek nebo koníčku – o tolik méně musí nést portfolio!
          </p>

          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="40000"
              step="2500"
              value={baristaIncome}
              onChange={(e) => setBaristaIncome(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 Kč (plný FIRE)</span>
              <span>15 000 Kč</span>
              <span className="text-emerald-400 font-bold">20 000 Kč (výchozí)</span>
              <span>30 000 Kč</span>
              <span>40 000 Kč</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Z portfolia stačí čerpat:</span>
              <MoneyDisplay amount={tiers.barista.monthlyExpenseCZK} className="text-xs font-bold text-slate-200 mt-0.5 block" />
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Cíl Barista FIRE:</span>
              <MoneyDisplay amount={tiers.barista.targetPortfolioCZK} className="text-xs font-bold text-emerald-400 mt-0.5 block" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Česká legislativní & daňová poznámka */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Česká daňová výhoda pro FIRE (§ 4 odst. 1 písm. w) ZDP):</strong> Akumulační ETF (jako S&P 500, VWCE) držená déle než 3 roky jsou zcela <strong>osvobozena od 15% daně z příjmu</strong>. Na rozdíl od dividendových akcií se při prodeji v rentě neplatí žádná daň, což snižuje potřebnou velikost cílového portfolia až o 15 až 20 %.
        </div>
      </div>
    </div>
  );
};
