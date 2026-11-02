import React, { useState } from 'react';
import { Landmark, Sparkles, TrendingUp, ShieldCheck, Check, ArrowRight, HelpCircle } from 'lucide-react';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { useBudgetStore } from '@/lib/stores/useBudgetStore';

export const DIPCalculatorCard: React.FC = () => {
  const salaryConfig = useBudgetStore((s) => s.salaryConfig);
  const updateSalaryConfig = useBudgetStore((s) => s.updateSalaryConfig);

  // User input states
  const [monthlySelfContribution, setMonthlySelfContribution] = useState<number>(4000); // 4000/mo = 48k/year max tax deduction
  const [monthlyEmployerMatch, setMonthlyEmployerMatch] = useState<number>(2000); // 2000/mo employer match
  const [taxBracketPct, setTaxBracketPct] = useState<15 | 23>(15);
  const [expectedReturnPct, setExpectedReturnPct] = useState<number>(8.0);
  const [investmentHorizonYears, setInvestmentHorizonYears] = useState<number>(20);

  // Calculations
  const annualSelfContribution = monthlySelfContribution * 12;
  const eligibleTaxDeduction = Math.min(48000, annualSelfContribution);
  const annualTaxRefund = Math.round(eligibleTaxDeduction * (taxBracketPct / 100));

  const annualEmployerContribution = monthlyEmployerMatch * 12;
  const eligibleEmployerExemption = Math.min(50000, annualEmployerContribution);

  // Total annual wealth injected into DIP
  const totalAnnualInflow = annualSelfContribution + annualEmployerContribution + annualTaxRefund;
  const monthlyEquivalentInflow = totalAnnualInflow / 12;

  // Compound future value calculation: FV = PMT * ((1 + r)^n - 1) / r
  const rYear = expectedReturnPct / 100;
  const compoundFutureValue = rYear > 0
    ? Math.round(totalAnnualInflow * ((Math.pow(1 + rYear, investmentHorizonYears) - 1) / rYear))
    : totalAnnualInflow * investmentHorizonYears;

  const totalOwnDeposits = annualSelfContribution * investmentHorizonYears;
  const freeWealthCreated = compoundFutureValue - totalOwnDeposits;

  // Check if tax refund bonus already exists in budget
  const hasTaxRefundBonus = (salaryConfig.bonuses || []).some(
    (b) => b.name.toLowerCase().includes('dip') || b.name.toLowerCase().includes('daňov')
  );

  const handleAddTaxBonusToBudget = async () => {
    const newBonus = {
      id: `bonus_dip_${Date.now()}`,
      name: 'DIP roční vratka daně (březen)',
      month: 3, // March
      amountNetCZK: annualTaxRefund,
      isRecurringAnnual: true,
    };
    await updateSalaryConfig({
      bonuses: [...(salaryConfig.bonuses || []), newBonus],
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-5 border border-indigo-500/30 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>DIP & Daňový akcelerátor (§ 15a ZDP)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                Až 7 200 Kč / rok od státu
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Dlouhodobý investiční produkt: jak daňové úlevy a příspěvky zaměstnavatele zkracují cestu k FIRE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 text-[11px] px-2">Sazba daně:</span>
          <button
            onClick={() => setTaxBracketPct(15)}
            className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
              taxBracketPct === 15 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            15 %
          </button>
          <button
            onClick={() => setTaxBracketPct(23)}
            className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
              taxBracketPct === 23 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            23 %
          </button>
        </div>
      </div>

      {/* Inputs Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
        {/* Vlastní měsíční vklad */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Vlastní vklad do DIP:</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={monthlySelfContribution}
              onChange={(e) => setMonthlySelfContribution(parseInt(e.target.value, 10) || 0)}
              step="500"
              max="10000"
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400">Kč/m</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Max odpočet: 48 000 Kč/rok (4 000 Kč/m)
          </span>
        </div>

        {/* Příspěvek zaměstnavatele */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 text-[11px] block">Příspěvek zaměstnavatele:</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={monthlyEmployerMatch}
              onChange={(e) => setMonthlyEmployerMatch(parseInt(e.target.value, 10) || 0)}
              step="500"
              max="10000"
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400">Kč/m</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Osvobozeno až do 50 000 Kč/rok
          </span>
        </div>

        {/* Roční daňová vratka */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
          <div>
            <span className="text-emerald-400 text-[11px] font-bold block">Čistá roční vratka daně:</span>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">
              +{annualTaxRefund.toLocaleString()} Kč / rok
            </div>
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1">
            Vyplaceno finančním úřadem v březnu
          </span>
        </div>

        {/* Investiční horizont */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] block">Horizont do 60 let:</span>
          <div className="flex items-center gap-1.5 mt-1">
            {[10, 15, 20, 25, 30].map((yr) => (
              <button
                key={yr}
                onClick={() => setInvestmentHorizonYears(yr)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  investmentHorizonYears === yr
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {yr}l
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Podmínka DIP: min. 120 měs. a 60 let</span>
        </div>
      </div>

      {/* Projection KPI Summary */}
      <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <div>
          <span className="text-slate-400 text-[10px] block">Vaše vlastní vklady za {investmentHorizonYears} let:</span>
          <MoneyDisplay amount={totalOwnDeposits} className="text-base font-bold text-slate-200 mt-0.5 block" />
        </div>

        <div>
          <span className="text-indigo-400 text-[10px] block">Budoucí hodnota DIP (při {expectedReturnPct}% p.a.):</span>
          <MoneyDisplay amount={compoundFutureValue} className="text-base font-bold text-indigo-400 mt-0.5 block" />
        </div>

        <div>
          <span className="text-emerald-400 text-[10px] block">„Peníze navíc“ (stát + zaměstnavatel + zisk):</span>
          <MoneyDisplay amount={freeWealthCreated} className="text-base font-bold text-emerald-400 mt-0.5 block" />
        </div>
      </div>

      {/* Action: Add Tax Refund into Budget */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
          Pokud reinvestujete roční daňovou vratku ({annualTaxRefund.toLocaleString()} Kč) zpět do akumulačních ETF, zrychlíte dosažení vašeho FIRE cíle o několik měsíců až let.
        </p>

        <button
          onClick={handleAddTaxBonusToBudget}
          disabled={hasTaxRefundBonus}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            hasTaxRefundBonus
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 opacity-80 cursor-default'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 hover:scale-105 active:scale-95'
          }`}
        >
          {hasTaxRefundBonus ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Vratka daně uložena v rozpočtu</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Přidat vratku daně (+{annualTaxRefund.toLocaleString()} Kč) do rozpočtu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
