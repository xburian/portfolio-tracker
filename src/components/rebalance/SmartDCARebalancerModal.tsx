import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Copy,
  Wallet,
  Coins,
  ShieldCheck,
  TrendingUp,
  Percent,
  Sliders,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { ValuationDetail, BrokerId } from '@/types/portfolio';
import { useBudgetStore } from '@/lib/stores/useBudgetStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { DcaRebalanceService } from '@/lib/services/dcaRebalanceService';
import { TargetAllocationItem, DCARebalanceResult } from '@/types/rebalance';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface SmartDCARebalancerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valuations: ValuationDetail[];
}

export const SmartDCARebalancerModal: React.FC<SmartDCARebalancerModalProps> = ({
  open,
  onOpenChange,
  valuations,
}) => {
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const salaryConfig = useBudgetStore((s) => s.salaryConfig);
  const expenses = useBudgetStore((s) => s.expenses);

  // Default deposit pulls from monthly net savings capacity
  const defaultMonthlyCapacity = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.monthlyAmountCZK, 0);
    return Math.max(5000, salaryConfig.baseMonthlyNetSalaryCZK - totalExpenses);
  }, [salaryConfig, expenses]);

  const [depositAmount, setDepositAmount] = useState<number>(defaultMonthlyCapacity);
  const [copied, setCopied] = useState(false);

  // Initial target allocations generated from current portfolio
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocationItem[]>(() => {
    return DcaRebalanceService.generateDefaultTargetAllocations(valuations);
  });

  // Calculate rebalance result using water-filling algorithm
  const rebalanceResult: DCARebalanceResult = useMemo(() => {
    return DcaRebalanceService.calculateDCARebalance(
      valuations,
      targetAllocations,
      depositAmount
    );
  }, [valuations, targetAllocations, depositAmount]);

  if (!open) return null;

  const totalTargetWeight = targetAllocations.reduce((acc, t) => acc + t.targetWeightPercent, 0);
  const isTargetSumValid = Math.abs(totalTargetWeight - 100) < 0.5;

  const handleWeightChange = (id: string, newWeight: number) => {
    setTargetAllocations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, targetWeightPercent: Math.max(0, newWeight) } : t))
    );
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = DcaRebalanceService.DEFAULT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Apply preset proportions across items
    setTargetAllocations((prev) => {
      const copy = [...prev];
      for (const pTarget of preset.targets) {
        const match = copy.find(
          (c) =>
            c.name.toLowerCase().includes(pTarget.targetName.toLowerCase().slice(0, 5)) ||
            (c.ticker && pTarget.targetName.includes(c.ticker))
        );
        if (match) {
          match.targetWeightPercent = pTarget.weightPercent;
        }
      }
      DcaRebalanceService.normalizeTargetWeights(copy);
      return copy;
    });
  };

  const handleCopyOrders = () => {
    const textLines: string[] = [];
    textLines.push(`SMART DCA NÁKUPNÍ PŘÍKAZY — Vklad: ${depositAmount.toLocaleString('cs-CZ')} Kč`);
    textLines.push(`Datum: ${new Date().toLocaleDateString('cs-CZ')}`);
    textLines.push('');

    for (const [broker, orders] of Object.entries(rebalanceResult.ordersByBroker)) {
      if (orders.length === 0) continue;
      textLines.push(`=== BROKER: ${broker} ===`);
      for (const o of orders) {
        textLines.push(
          `- Koupit ${o.sharesToBuy} ks ${o.ticker} (${o.name}) za cca ${o.allocatedAmountCZK.toLocaleString('cs-CZ')} Kč (${o.allocatedAmountNative} ${o.instrumentCurrency})`
        );
      }
      textLines.push('');
    }

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0F1420] border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Smart DCA Rebalancer</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Bezdanový
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Dorovnání cílových vah novým vkladem bez prodeje aktiv a bez daní (§ 4 ZDP)
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
          {/* 1. Deposit Amount Controller */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-200 block">
                  Měsíční vklad k investování (Kč)
                </label>
                <span className="text-[11px] text-slate-400">
                  Částka, kterou chcete tento měsíc rozdělit do portfolia
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-36 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold font-mono text-emerald-400 text-right focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs font-bold text-slate-400">Kč</span>
              </div>
            </div>

            {/* Quick Quick-Fill Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60 text-xs">
              <span className="text-slate-500 text-[11px]">Rychlá volba:</span>
              <button
                onClick={() => setDepositAmount(defaultMonthlyCapacity)}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
              >
                Z rozpočtu (+{defaultMonthlyCapacity.toLocaleString('cs-CZ')} Kč)
              </button>
              {[10000, 20000, 30000, 50000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(amt)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  +{amt.toLocaleString('cs-CZ')} Kč
                </button>
              ))}
            </div>
          </div>

          {/* 2. Target Allocations & Presets */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Cílová alokace aktiv</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Nastavte požadované procentuální zastoupení jednotlivých složek
                </p>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">Šablony:</span>
                {DcaRebalanceService.DEFAULT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700/60"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Validation warning if sum != 100% */}
            {!isTargetSumValid && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Součet cílových vah je <strong>{totalTargetWeight.toFixed(1)} %</strong> (měl by být 100.0 %). Upravte váhy nebo klikněte na šablonu.
                </span>
              </div>
            )}

            {/* Allocation rows table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Aktivum / Klastr</th>
                    <th className="py-2.5 px-2 text-right">Současná hodnota</th>
                    <th className="py-2.5 px-2 text-center w-24">Současná váha</th>
                    <th className="py-2.5 px-2 text-center w-28">Cílová váha</th>
                    <th className="py-2.5 px-2 text-right">Alokováno z vkladu</th>
                    <th className="py-2.5 px-3 text-center w-24">Váha po vkladu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {rebalanceResult.targetAllocations.map((item) => {
                    const isUnder = item.driftPercent < -0.5;
                    const isOver = item.driftPercent > 0.5;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-semibold text-slate-200 block truncate max-w-[180px]">
                            {item.name}
                          </span>
                          {item.ticker && (
                            <span className="text-[10px] text-slate-400 font-mono">{item.ticker}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {item.currentValueCZK.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            isUnder ? 'text-cyan-300 bg-cyan-950/40' : isOver ? 'text-amber-300 bg-amber-950/40' : 'text-slate-300'
                          }`}>
                            {item.currentWeightPercent.toFixed(1)} %
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 font-sans">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={item.targetWeightPercent}
                              onChange={(e) => handleWeightChange(item.id, Number(e.target.value) || 0)}
                              className="w-14 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold font-mono text-center focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-slate-500 text-[11px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold">
                          {item.allocatedDepositCZK > 0 ? (
                            <span className="text-emerald-400">
                              +{item.allocatedDepositCZK.toLocaleString('cs-CZ')} Kč
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-slate-200 font-bold">
                            {item.postDepositWeightPercent.toFixed(1)} %
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Generated Broker Order Slips */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>Doporučené nákupní lístky k zadání</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Přesné počty kusů akcií a ETF k nákupu na jednotlivých účtech
                </p>
              </div>

              <button
                onClick={handleCopyOrders}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? '✓ Zkopírováno!' : 'Kopírovat příkazy'}</span>
              </button>
            </div>

            {rebalanceResult.orders.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                Zadejte nenulovou částku vkladu k vygenerování nákupních lístků.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rebalanceResult.orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100 tracking-tight font-mono">
                          {order.ticker}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {order.brokerId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate mt-0.5">
                        {order.name}
                      </span>
                      <span className="text-[10px] text-indigo-400 mt-1">
                        Cena: {order.currentPriceNative.toFixed(2)} {order.instrumentCurrency}
                      </span>
                    </div>

                    <div className="flex flex-col items-end shrink-0 text-right">
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        Koupit {order.sharesToBuy} ks
                      </span>
                      <span className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                        ~{order.allocatedAmountCZK.toLocaleString('cs-CZ')} Kč
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({order.allocatedAmountNative.toLocaleString('cs-CZ')} {order.instrumentCurrency})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>100% Bezdanový rebalancing:</strong> Žádné nucené prodeje ziskových pozic ani reset 3letého časového testu (§ 4 ZDP).
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-slate-300">
              Snížení odchylky: <strong>{rebalanceResult.maxDriftBeforePercent.toFixed(1)} %</strong> → <strong className="text-emerald-400">{rebalanceResult.maxDriftAfterPercent.toFixed(1)} %</strong>
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
