import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  ArrowUpRight,
  Info,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { TaxLossHarvestingService } from '@/lib/services/taxLossHarvestingService';
import { AnnualTaxReport, GroupedTaxLossCandidate, EtfSubstituteSuggestion } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface TaxLossOptimizerPanelProps {
  report: AnnualTaxReport;
}

export const TaxLossOptimizerPanel: React.FC<TaxLossOptimizerPanelProps> = ({ report }) => {
  const holdings = usePortfolioStore((s) => s.holdings);
  const lots = usePortfolioStore((s) => s.lots);
  const accounts = usePortfolioStore((s) => s.accounts);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const [selectedGroups, setSelectedGroups] = useState<Record<string, number>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [activeSubstituteModal, setActiveSubstituteModal] = useState<{
    symbol: string;
    substitute: EtfSubstituteSuggestion;
  } | null>(null);

  // 1. Scan candidate lots for harvesting (< 3 years, in loss)
  const candidates = useMemo(() => {
    return TaxLossHarvestingService.findCandidates(holdings, lots, accounts, displayCurrency);
  }, [holdings, lots, accounts, displayCurrency]);

  // 2. Group candidate lots by Ticker/Symbol (Clean macro-view requested by investor)
  const groupedCandidates = useMemo(() => {
    return TaxLossHarvestingService.groupCandidatesByTicker(candidates);
  }, [candidates]);

  // 3. Scan upcoming exempt lots (< 60 days to 3-year test)
  const upcomingExempt = useMemo(() => {
    return TaxLossHarvestingService.getUpcomingExemptLots(holdings, lots, new Date(), 60);
  }, [holdings, lots]);

  // Toggle selection with default 100% quantity for the grouped ticker
  const handleToggleGroup = (group: GroupedTaxLossCandidate) => {
    setSelectedGroups((prev) => {
      const next = { ...prev };
      if (next[group.id] !== undefined) {
        delete next[group.id];
      } else {
        next[group.id] = group.totalLossQuantity;
      }
      return next;
    });
  };

  // Change quantity for grouped candidate
  const handleQuantityChange = (group: GroupedTaxLossCandidate, qty: number) => {
    const clamped = Math.max(0, Math.min(group.totalLossQuantity, Math.round(qty * 10000) / 10000));
    setSelectedGroups((prev) => ({
      ...prev,
      [group.id]: clamped,
    }));
  };

  // Set percentage of grouped candidate
  const handleSetPercent = (group: GroupedTaxLossCandidate, pct: number) => {
    const qty = Math.round(group.totalLossQuantity * (pct / 100) * 10000) / 10000;
    setSelectedGroups((prev) => ({
      ...prev,
      [group.id]: qty,
    }));
  };

  // Select all grouped candidates with 100% volume
  const handleSelectAll = () => {
    const all: Record<string, number> = {};
    for (const g of groupedCandidates) {
      all[g.id] = g.totalLossQuantity;
    }
    setSelectedGroups(all);
  };

  const handleClearAll = () => {
    setSelectedGroups({});
  };

  // 4. Compute live simulation using HIFO allocation
  const simulation = useMemo(() => {
    const selections = groupedCandidates
      .filter((g) => (selectedGroups[g.id] || 0) > 0)
      .map((g) => ({
        candidate: g,
        harvestQuantity: selectedGroups[g.id],
      }));

    return TaxLossHarvestingService.simulateHarvestGrouped(report, selections);
  }, [report, groupedCandidates, selectedGroups]);

  const preGain = report.securities.netSecuritiesResultCZK;
  const preTaxDue = report.securities.estimatedTaxSecuritiesCZK;
  const postTaxDue = simulation.postOptimization.newSec10TaxDueCZK;
  const netSaved = simulation.postOptimization.netCashSavedCZK;

  return (
    <div className="flex flex-col gap-6">
      {/* Upcoming Exemption Banner */}
      {upcomingExempt.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-200">
                ⏳ Časový test na dosah u ziskových pozic
              </div>
              <div className="text-[11px] text-indigo-300/80 mt-0.5">
                {upcomingExempt.map((u) => (
                  <span key={u.lotId} className="mr-2">
                    <strong>{u.ticker}</strong> ({u.quantity} ks, zisk +{u.unrealizedGainCZK.toLocaleString('cs-CZ')} Kč) za{' '}
                    <span className="font-bold underline text-indigo-200">{u.daysRemaining} dní</span> osvobozen!
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 shrink-0 font-semibold">
            Doporučení: Neprodávat
          </span>
        </div>
      )}

      {/* Main Split Layout: Candidates Table (Left) + Live Simulation Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Candidates list grouped by Ticker */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Ztrátové pozice držené méně než 3 roky (zgrupováno podle tickeru)
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Vyberte tituly k simulovanému daňovému odprodeji pro optimalizaci zisku § 10 ZDP.
              </p>
            </div>

            {groupedCandidates.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
                >
                  Vybrat vše ({groupedCandidates.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium transition-colors"
                >
                  Zrušit
                </button>
              </div>
            )}
          </div>

          {groupedCandidates.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="text-sm font-bold text-slate-200">
                Žádné otevřené neosvobozené ztráty
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                V portfoliu nejsou žádné pozice držené méně než 3 roky, které by byly v nerealizované ztrátě. Všechny stávající loty jsou buď v zisku, nebo již splnily 3letý časový test (§ 4 odst. 1 písm. w ZDP).
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groupedCandidates.map((group) => {
                const isSelected = selectedGroups[group.id] !== undefined;
                const selectedQty = selectedGroups[group.id] ?? group.totalLossQuantity;
                const isExpanded = expandedGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-slate-900/90 border-indigo-500/50 shadow-md shadow-indigo-950/20'
                        : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Checkbox & Header */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGroup(group)}
                          className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-base">
                              {group.symbol}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                              {group.brokerNames.join(', ')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="Ztrátová hustota: Ztráta / Tržní hodnota">
                              Hustota: {group.lossDensity}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700/60">
                              {group.lotsCount} {group.lotsCount === 1 ? 'nákup' : group.lotsCount < 5 ? 'nákupy' : 'nákupů'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[280px]">
                            {group.name}
                          </div>
                        </div>
                      </div>

                      {/* Loss Amount & Potential Tax Saved */}
                      <div className="text-right">
                        <div className="text-base font-mono font-bold text-rose-400">
                          {group.totalUnrealizedLossCZK.toLocaleString('cs-CZ')} Kč
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                          Úspora až +{group.potentialTaxSavingsCZK.toLocaleString('cs-CZ')} Kč
                        </div>
                        <div className="text-[10px] font-mono text-rose-400/80">
                          ({group.lossPercent} %)
                        </div>
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 py-2 border-y border-slate-800/60 text-[11px] text-slate-400 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">Objem k optimalizaci:</span>
                        <span className="font-bold text-slate-200">{group.totalLossQuantity} ks</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">Průměr nákup / Trh:</span>
                        {group.averageOpenPriceNative} / {group.currentPriceNative} {group.instrumentCurrency}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">Doba držení:</span>
                        {group.newestHoldingDays === group.oldestHoldingDays
                          ? `${group.newestHoldingDays} dní`
                          : `${group.newestHoldingDays} – ${group.oldestHoldingDays} dní`}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">Do 3letého testu:</span>
                        nejstarší za {group.minDaysToTimeTest} dní
                      </div>
                    </div>

                    {/* Quantity Slider if Selected & Substitute Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      {isSelected ? (
                        <div className="flex flex-col gap-1.5 flex-1 max-w-md">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-400 font-sans text-[11px]">Objem k prodeji:</span>
                            <span className="font-bold text-indigo-300">
                              {selectedQty} / {group.totalLossQuantity} ks ({Math.round((selectedQty / group.totalLossQuantity) * 100)} %)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max={group.totalLossQuantity}
                              step={group.totalLossQuantity > 10 ? '1' : '0.0001'}
                              value={selectedQty}
                              onChange={(e) => handleQuantityChange(group, parseFloat(e.target.value))}
                              className="w-full accent-indigo-500 cursor-pointer"
                            />
                          </div>

                          {/* Quick Percent Buttons */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {[25, 50, 75, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleSetPercent(group, pct)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                  Math.round((selectedQty / group.totalLossQuantity) * 100) === pct
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                {pct} %
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          Zaškrtněte pro simulaci odprodeje této pozice
                        </div>
                      )}

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {group.suggestedSubstitute && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSubstituteModal({
                                symbol: group.symbol,
                                substitute: group.suggestedSubstitute!,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Substituce ({group.suggestedSubstitute.ticker})</span>
                          </button>
                        )}

                        {group.lotsCount > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                          >
                            <span>{isExpanded ? 'Skrýt' : `${group.lotsCount} nákupy`}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable list of underlying lots */}
                    {isExpanded && group.lotsCount > 1 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Podkladové nákupní loty (řazeno HIFO dle největší ztráty):
                        </div>
                        <div className="divide-y divide-slate-800/50 bg-slate-950/60 rounded-xl border border-slate-800/60 overflow-hidden font-mono text-[11px]">
                          {group.lots.map((lot) => (
                            <div key={lot.lotId} className="p-2 flex items-center justify-between text-slate-300">
                              <div>
                                <span className="font-semibold text-slate-200">{lot.quantity} ks</span>
                                <span className="text-slate-500 text-[10px] ml-2">
                                  Nákup: {new Date(lot.openDateUtc).toLocaleDateString('cs-CZ')} za {lot.openPriceNative} {lot.instrumentCurrency}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-rose-400 font-bold">{lot.unrealizedLossCZK.toLocaleString('cs-CZ')} Kč</span>
                                <span className="text-slate-500 text-[10px] ml-2">({lot.holdingDays} dní)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Simulation & Safety Guards */}
        <div className="flex flex-col gap-4 sticky top-6">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-indigo-500/30 shadow-xl shadow-indigo-950/20">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Simulace daňové úspory
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                LIVE § 10
              </span>
            </div>

            {/* Net Cash Saved Hero */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 mb-4 text-center">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Čistá peněžní úspora na dani
              </div>
              <div className={`text-3xl font-extrabold font-mono tracking-tight ${
                netSaved > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                +{netSaved.toLocaleString('cs-CZ')} Kč
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {netSaved > 0
                  ? 'Reálná hotovost ušetřená na doplatku FÚ v daňovém přiznání'
                  : 'Vyberte ztrátové tituly vlevo pro simulaci snížení daně'}
              </div>
            </div>

            {/* Comparison Metrics: Před vs. Po */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 font-sans">Realizovaná ztráta (Harvest):</span>
                <span className="font-bold text-rose-400">
                  -{simulation.postOptimization.totalLossHarvestedCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 font-sans">Vygenerované tržby (Hrubé):</span>
                <span className="font-bold text-slate-200">
                  +{simulation.postOptimization.totalProceedsGeneratedCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 font-sans">Původní základ daně § 10:</span>
                <span className="font-bold text-slate-300">
                  {report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                <span className="font-sans font-semibold">Nový základ daně § 10:</span>
                <span className="font-bold font-mono">
                  {simulation.postOptimization.newSec10TaxBaseCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                <span className="font-sans font-semibold">Nová daň k úhradě § 10:</span>
                <span className="font-bold font-mono text-sm">
                  {simulation.postOptimization.newSec10TaxDueCZK.toLocaleString('cs-CZ')} Kč
                  {preTaxDue > 0 && postTaxDue < preTaxDue && (
                    <span className="text-xs text-emerald-400/80 font-normal ml-1">
                      (bylo {preTaxDue} Kč)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Safety Guards Alerts */}
            {/* Guard 1: The 100k Cliff Paradox Warning */}
            {simulation.postOptimization.breaks100kCliff && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300">
                  <strong>Pozor na prolomení limitu 100k Kč!</strong>
                  <p className="text-[11px] text-amber-400/80 mt-0.5">
                    Před prodejem byly vaše hrubé příjmy osvobozeny do 100 000 Kč. Realizace tohoto prodeje posouvá celkové příjmy nad limit a ruší osvobození.
                  </p>
                </div>
              </div>
            )}

            {/* Guard 2: Over-harvesting saturation alert */}
            {simulation.postOptimization.isOverHarvested && (
              <div className="mt-4 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-300">
                  <strong>Strop saturace dosažen</strong>
                  <p className="text-[11px] text-sky-400/80 mt-0.5">
                    Základ daně byl vynulován na 0 Kč. Ztráta ve výši{' '}
                    <strong>{simulation.postOptimization.overHarvestAmountCZK.toLocaleString('cs-CZ')} Kč</strong>{' '}
                    již nepřináší žádnou další daňovou úsporu (v ČR nelze ztrátu z § 10 započíst proti mzdě ani převést do dalších let).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ETF Substitute Modal */}
      {activeSubstituteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h4 className="text-base font-bold text-slate-100">
                  Doporučená ETF substituce
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubstituteModal(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <div className="text-[10px] uppercase font-sans text-slate-500">Prodávaný titul:</div>
                <div className="text-sm font-bold text-slate-200">{activeSubstituteModal.symbol}</div>
              </div>

              <div className="flex items-center justify-center text-slate-600">
                <ArrowRight className="w-5 h-5 text-indigo-400" />
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <div className="text-[10px] uppercase font-sans text-emerald-400 font-semibold">Doporučená alternativa:</div>
                <div className="text-base font-bold text-emerald-300 font-mono mt-0.5">
                  {activeSubstituteModal.substitute.ticker}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {activeSubstituteModal.substitute.name}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  ISIN: {activeSubstituteModal.substitute.isin}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 leading-relaxed">
                <div className="text-[10px] uppercase font-semibold text-indigo-400 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Ochrana proti zneužití práva (§ 8 odst. 4 Daňový řád)</span>
                </div>
                {activeSubstituteModal.substitute.description}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubstituteModal(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              Rozumím, zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
