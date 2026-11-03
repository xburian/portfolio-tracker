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
} from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { TaxLossHarvestingService } from '@/lib/services/taxLossHarvestingService';
import { AnnualTaxReport, TaxLossCandidate } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface TaxLossOptimizerPanelProps {
  report: AnnualTaxReport;
}

export const TaxLossOptimizerPanel: React.FC<TaxLossOptimizerPanelProps> = ({ report }) => {
  const holdings = usePortfolioStore((s) => s.holdings);
  const lots = usePortfolioStore((s) => s.lots);
  const accounts = usePortfolioStore((s) => s.accounts);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const [selectedLots, setSelectedLots] = useState<Record<string, number>>({});
  const [activeSubstituteModal, setActiveSubstituteModal] = useState<TaxLossCandidate | null>(null);

  // 1. Scan candidate lots for harvesting (< 3 years, in loss)
  const candidates = useMemo(() => {
    return TaxLossHarvestingService.findCandidates(holdings, lots, accounts, displayCurrency);
  }, [holdings, lots, accounts, displayCurrency]);

  // 2. Scan upcoming exempt lots (< 60 days to 3-year test)
  const upcomingExempt = useMemo(() => {
    return TaxLossHarvestingService.getUpcomingExemptLots(holdings, lots, new Date(), 60);
  }, [holdings, lots]);

  // Toggle selection with default 100% quantity
  const handleToggleLot = (candidate: TaxLossCandidate) => {
    setSelectedLots((prev) => {
      const next = { ...prev };
      if (next[candidate.lotId] !== undefined) {
        delete next[candidate.lotId];
      } else {
        next[candidate.lotId] = candidate.quantity;
      }
      return next;
    });
  };

  // Change quantity for candidate
  const handleQuantityChange = (candidate: TaxLossCandidate, qty: number) => {
    setSelectedLots((prev) => ({
      ...prev,
      [candidate.lotId]: Math.max(0, Math.min(candidate.quantity, qty)),
    }));
  };

  // Select all candidates to saturate taxable gain
  const handleSelectAll = () => {
    const all: Record<string, number> = {};
    for (const c of candidates) {
      all[c.lotId] = c.quantity;
    }
    setSelectedLots(all);
  };

  const handleClearAll = () => {
    setSelectedLots({});
  };

  // 3. Compute live simulation
  const simulation = useMemo(() => {
    const selections = candidates
      .filter((c) => (selectedLots[c.lotId] || 0) > 0)
      .map((c) => ({
        candidate: c,
        harvestQuantity: selectedLots[c.lotId],
      }));

    return TaxLossHarvestingService.simulateHarvest(report, selections);
  }, [report, candidates, selectedLots]);

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
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 shrink-0">
            Doporučení: Neprodávat
          </span>
        </div>
      )}

      {/* Main Split Layout: Candidates Table (Left) + Live Simulation Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Candidates list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Ztrátové loty držené méně než 3 roky (Kandidáti)
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Vyberte pozice k simulovanému prodeji pro započtení proti zdanitelnému zisku § 10.
              </p>
            </div>

            {candidates.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                >
                  Vybrat vše
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

          {candidates.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="text-sm font-bold text-slate-200">
                Žádné otevřené neosvobozené ztráty
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                V portfoliu nejsou žádné pozice držené méně než 3 roky, které by byly v nerealizované ztrátě. Všechny stávající loty jsou buď v zisku, nebo již splnily 3letý časový test.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {candidates.map((candidate) => {
                const isSelected = selectedLots[candidate.lotId] !== undefined;
                const selectedQty = selectedLots[candidate.lotId] || candidate.quantity;

                return (
                  <div
                    key={candidate.lotId}
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
                          onChange={() => handleToggleLot(candidate)}
                          className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-sm">
                              {candidate.symbol}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                              {candidate.brokerId}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="Ztrátová hustota: Ztráta / Tržní hodnota">
                              Hustota: {candidate.lossDensity}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                            {candidate.name}
                          </div>
                        </div>
                      </div>

                      {/* Loss Amount & Potential Tax Saved */}
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-rose-400">
                          {candidate.unrealizedLossCZK.toLocaleString('cs-CZ')} Kč
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                          Úspora až +{candidate.potentialTaxSavingsCZK.toLocaleString('cs-CZ')} Kč
                        </div>
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 py-2 border-y border-slate-800/60 text-[11px] text-slate-400 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Objem:</span>
                        {candidate.quantity} ks
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Nákup / Trh:</span>
                        {candidate.openPriceNative} / {candidate.currentPriceNative} {candidate.instrumentCurrency}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Doba držení:</span>
                        {candidate.holdingDays} dní
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Do 3letého testu:</span>
                        {candidate.daysToTimeTest} dní
                      </div>
                    </div>

                    {/* Quantity Slider if Selected & Substitute Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      {isSelected ? (
                        <div className="flex items-center gap-3 flex-1 max-w-sm">
                          <span className="text-[11px] text-slate-400 shrink-0">Prodat:</span>
                          <input
                            type="range"
                            min="0"
                            max={candidate.quantity}
                            step={candidate.quantity > 10 ? 1 : 0.1}
                            value={selectedQty}
                            onChange={(e) => handleQuantityChange(candidate, parseFloat(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer"
                          />
                          <span className="text-xs font-mono font-bold text-slate-200 shrink-0 w-16 text-right">
                            {selectedQty} ks
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Zaškrtněte pro zahrnutí do simulace
                        </div>
                      )}

                      {/* ETF Substitute Suggestion Pill */}
                      {candidate.suggestedSubstitute && (
                        <button
                          type="button"
                          onClick={() => setActiveSubstituteModal(candidate)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-medium border border-indigo-500/20 transition-colors ml-auto"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Doporučená substituce: {candidate.suggestedSubstitute.ticker}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Simulation Card */}
        <div className="flex flex-col gap-4 sticky top-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Živá simulace daňové úspory
                </h4>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Před vs. Po
              </span>
            </div>

            {/* Before vs. After comparison deck */}
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  1. Před optimalizací (§ 10 ZDP)
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Čistý zisk z prodejů:</span>
                  <span className={`font-mono font-bold ${preGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {preGain > 0 ? '+' : ''}{preGain.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300 mt-1">
                  <span>Daňová povinnost (15 %):</span>
                  <span className="font-mono font-bold text-slate-100">
                    {preTaxDue.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center my-0.5">
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90" />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  2. Vybrané ztráty k realizaci
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Ztráta k uplatnění:</span>
                  <span className="font-mono font-bold text-rose-400">
                    -{simulation.postOptimization.totalLossHarvestedCZK.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300 mt-1">
                  <span>Generované tržby:</span>
                  <span className="font-mono text-slate-400">
                    +{simulation.postOptimization.totalProceedsGeneratedCZK.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center my-0.5">
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90" />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  3. Po simulovaném prodeji
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Nový základ daně § 10:</span>
                  <span className="font-mono font-bold text-slate-100">
                    {simulation.postOptimization.newSec10TaxBaseCZK.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300 mt-1">
                  <span>Nová daňová povinnost:</span>
                  <span className="font-mono font-bold text-slate-100">
                    {postTaxDue.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              </div>
            </div>

            {/* Net Tax Saved Emerald Glow Card */}
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center shadow-lg shadow-emerald-950/30">
              <div className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                Čistá úspora na dani z příjmů
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight my-1">
                +{netSaved.toLocaleString('cs-CZ')} Kč
              </div>
              <div className="text-[11px] text-emerald-300/80">
                Hotovost ušetřená vůči Finančnímu úřadu
              </div>
            </div>

            {/* Safety Guard 1: Cliff Paradox Warning */}
            {simulation.postOptimization.breaks100kCliff && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-200">
                    🛑 Pozor: Prolomení 100 000 Kč limitu!
                  </div>
                  <p className="text-rose-300/90 text-[11px] mt-1 leading-snug">
                    Tento prodej zvýší vaše celkové roční tržby nad 100 000 Kč. Ztratíte tak plné osvobození dle § 4(1)(v) ZDP a na dani zaplatíte VÍCE než nyní (nyní platíte 0 Kč). Prodej se v tomto roce nevyplatí!
                  </p>
                </div>
              </div>
            )}

            {/* Safety Guard 2: Over-harvesting Warning */}
            {simulation.postOptimization.isOverHarvested && (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-200">
                    Upozornění na nadměrný harvesting
                  </div>
                  <p className="text-amber-300/90 text-[11px] mt-1 leading-snug">
                    Daňový základ byl již snížen na 0 Kč. Další realizovaná ztráta ve výši{' '}
                    <strong>{simulation.postOptimization.overHarvestAmountCZK.toLocaleString('cs-CZ')} Kč</strong>{' '}
                    nepřinese žádnou daňovou úlevu (v ČR nelze ztrátu z CP převádět do dalších let ani odečíst ze mzdy).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Substitute Information Modal */}
      {activeSubstituteModal && activeSubstituteModal.suggestedSubstitute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Doporučená substituce: {activeSubstituteModal.symbol}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubstituteModal(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Prodat:</span>
                <span className="font-bold font-mono text-rose-400">{activeSubstituteModal.symbol} ({activeSubstituteModal.name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nakoupit náhradu:</span>
                <span className="font-bold font-mono text-emerald-400">{activeSubstituteModal.suggestedSubstitute.ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ISIN náhrady:</span>
                <span className="font-mono text-slate-300">{activeSubstituteModal.suggestedSubstitute.isin}</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-500/20">
              <div className="font-semibold text-indigo-200 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Proč tato substituce? (§ 8 odst. 4 Daňového řádu)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {activeSubstituteModal.suggestedSubstitute.description}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Nákupem odlišného ETF na stejný index zůstává vaše portfolio 100% zainvestované na trhu, ale pro Finanční správu jde o legitimní investiční rozhodnutí bez rizika klasifikace jako zneužití práva (tzv. wash sale).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubstituteModal(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Rozumím
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
