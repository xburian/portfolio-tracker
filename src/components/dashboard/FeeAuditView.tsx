import React, { useMemo } from 'react';
import {
  Receipt,
  ArrowRightLeft,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { FeeAuditSummary } from '@/types/portfolio';
import { PerformanceService } from '@/lib/services/performanceService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

export const FeeAuditView: React.FC = () => {
  const closedPositions = usePortfolioStore((s) => s.closedPositions);
  const lots = usePortfolioStore((s) => s.lots);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const feeAudit: FeeAuditSummary = useMemo(() => {
    return PerformanceService.calculateFeeAudit(
      closedPositions,
      lots,
      [],
      displayCurrency
    );
  }, [closedPositions, lots, displayCurrency]);

  const commPercent = feeAudit.totalFeesPaidTarget > 0
    ? Math.round((feeAudit.totalCommissionsTarget / feeAudit.totalFeesPaidTarget) * 100)
    : 30;
  const fxPercent = 100 - commPercent;

  return (
    <div className="flex flex-col gap-6">
      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Celkové zaplacené poplatky */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Celkové poplatky</span>
            <Receipt className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-rose-400">
              <MoneyDisplay amount={feeAudit.totalFeesPaidTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Komise + FX spready
            </p>
          </div>
        </div>

        {/* 2. Přímé poplatky brokerům */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Komise brokerům</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">
              <MoneyDisplay amount={feeAudit.totalCommissionsTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Nákupní a prodejní poplatky
            </p>
          </div>
        </div>

        {/* 3. Měnový spread drag */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FX Spread Drag</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-cyan-300">
              <MoneyDisplay amount={feeAudit.totalFxSpreadFeesTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Skrytá marže na konverzi (~0.25%)
            </p>
          </div>
        </div>

        {/* 4. Složená ztráta za 20 let (Opportunity Cost) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ztráta za 20 let (8% p.a.)</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-rose-300">
              <MoneyDisplay amount={feeAudit.compoundedLoss20YearsTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ztracený budoucí kapitál
            </p>
          </div>
        </div>
      </div>

      {/* Visual Fee Breakdown Bar */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              Rozpad nákladů a poplatků
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Kde portfolio reálně přichází o kapitál
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Odhadovaný drag:{' '}
            <span className="text-amber-400 font-bold">
              {feeAudit.feeDragPercentPerAnnum.toFixed(2)} % ročně
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex">
          <div
            className="bg-amber-500 hover:bg-amber-400 transition-all h-full"
            style={{ width: `${commPercent}%` }}
            title={`Komise: ${commPercent}%`}
          />
          <div
            className="bg-cyan-500 hover:bg-cyan-400 transition-all h-full"
            style={{ width: `${fxPercent}%` }}
            title={`FX Spread Drag: ${fxPercent}%`}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span>Přímé komise brokerů ({commPercent} %)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-cyan-500 inline-block" />
            <span>FX konverzní spready ({fxPercent} %)</span>
          </div>
        </div>
      </div>

      {/* FIRE Cost Optimization Checklist */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/70 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Doporučení pro minimalizaci poplatkového úniku (Leakage)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/90 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Multi-měnové podúčty</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Držte USD a EUR přímo na dedikovaných účtech (např. XTB USD a EUR). Přímé vklady přes Revolut bez poplatku za konverzi šetří 0.5% na každém nákupu.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/90 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Akumulační ETF (Acc)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              U dividendových titulů dochází ke stržení 15% srážkové daně. Akumulační ETF reinvestují dividendy bez zdanění a bez poplatků za transakci.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/90 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DIP daňová kompenzace</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Roční daňová úleva DIP až 7 200 Kč (§ 15a ZDP) plně pokryje veškeré poplatky portfolio tradingu a přispívá k čisté rentě.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
