import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Scale,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  Search,
  Calendar,
  X,
} from 'lucide-react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { TruncatedTextWithTooltip } from '@/components/common/TruncatedTextWithTooltip';
import { TaxTimeTestService, GroupedTimeTestStatus } from '@/lib/services/taxTimeTestService';
import { RebalanceService, RebalanceTarget } from '@/lib/services/rebalanceService';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

interface TaxTimeTestCardProps {
  valuations: ValuationDetail[];
}

export const TaxTimeTestCard: React.FC<TaxTimeTestCardProps> = ({ valuations }) => {
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const lots = usePortfolioStore((s) => s.lots);
  const accounts = usePortfolioStore((s) => s.accounts);

  const [activeTab, setActiveTab] = useState<'timetest' | 'rebalance'>('timetest');
  const [groupingMode, setGroupingMode] = useState<'grouped' | 'individual'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exempt' | 'locked'>('all');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [inflowCash, setInflowCash] = useState<number>(20000);

  // Time Test Summary (Calculates both grouped across brokers and flat individual holdings)
  const timeTestSummary = useMemo(() => {
    return TaxTimeTestService.calculateGroupedSummary(valuations, lots, accounts, displayCurrency);
  }, [valuations, lots, accounts, displayCurrency]);

  // Rebalance Calculations
  const clusterMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number }>();
    for (const v of valuations) {
      if (v.holding.assetClass === 'CASH') continue;
      const key = v.holding.benchmark || v.holding.tags[0] || v.holding.name;
      if (!map.has(key)) {
        map.set(key, { id: key, name: key, value: 0 });
      }
      map.get(key)!.value += v.marketValueTarget;
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [valuations]);

  const rebalanceOrders = useMemo(() => {
    if (clusterMap.length === 0 || inflowCash <= 0) return [];
    const defaultWeight = 1 / clusterMap.length;
    const targets: RebalanceTarget[] = clusterMap.map((c) => ({
      id: c.id,
      name: c.name,
      currentValue: c.value,
      targetWeight: defaultWeight,
    }));
    return RebalanceService.calculateBuyOnly(targets, inflowCash);
  }, [clusterMap, inflowCash]);

  // Filtered Grouped Holdings
  const filteredGrouped = useMemo(() => {
    let list = timeTestSummary.groupedHoldings;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (g) =>
          g.canonicalTicker.toLowerCase().includes(q) ||
          g.displaySymbol.toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q) ||
          (g.isin && g.isin.toLowerCase().includes(q)) ||
          g.brokers.some((b) => b.brokerId.toLowerCase().includes(q) || b.accountName.toLowerCase().includes(q))
      );
    }
    if (statusFilter === 'exempt') {
      list = list.filter((g) => g.exemptQuantity > 0.0001);
    } else if (statusFilter === 'locked') {
      list = list.filter((g) => g.lockedQuantity > 0.0001);
    }
    return list;
  }, [timeTestSummary.groupedHoldings, searchQuery, statusFilter]);

  // Filtered Flat Individual Holdings
  const filteredFlat = useMemo(() => {
    let list = timeTestSummary.holdings;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (h) => h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'exempt') {
      list = list.filter((h) => h.exemptQuantity > 0.0001);
    } else if (statusFilter === 'locked') {
      list = list.filter((h) => h.lockedQuantity > 0.0001);
    }
    return list;
  }, [timeTestSummary.holdings, searchQuery, statusFilter]);

  if (valuations.length === 0) return null;

  return (
    <div className="bg-[#0F1420] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col">
      {/* Header with Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">
                Český 3letý časový test (§ 4 odst. 1 písm. w) ZDP)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Osvobozeno od 15% daně
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Přehled pozic držených déle než 3 roky napříč všemi brokery – zisk z jejich prodeje nepodléhá dani z příjmů
            </p>
          </div>
        </div>

        {/* View Switcher: Time Test vs Rebalance */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('timetest')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'timetest'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Časový test ({timeTestSummary.overallExemptPercentage} %)</span>
          </button>
          <button
            onClick={() => setActiveTab('rebalance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'rebalance'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Kalkulátor nákupů</span>
          </button>
        </div>
      </div>

      {activeTab === 'timetest' ? (
        /* Tab 1: Time Test Analysis */
        <div className="flex flex-col gap-5 mt-5">
          {/* Top Metric Deck */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Celkem osvobozeno */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Osvobozeno k prodeji</span>
              </span>
              <div className="mt-2">
                <MoneyDisplay
                  amount={timeTestSummary.totalExemptMarketValue}
                  currency={displayCurrency}
                  className="text-xl sm:text-2xl font-bold text-emerald-400"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  <span className="font-semibold text-emerald-300">
                    {timeTestSummary.overallExemptPercentage} %
                  </span>{' '}
                  z cenných papírů ({timeTestSummary.totalMarketValue.toLocaleString('cs-CZ')} {displayCurrency})
                </div>
              </div>
            </div>

            {/* 2. Ušetřená daň z příjmů */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ušetřená daň (15 %)</span>
              </span>
              <div className="mt-2">
                <MoneyDisplay
                  amount={timeTestSummary.totalEstimatedTaxSaved}
                  currency={displayCurrency}
                  className="text-xl sm:text-2xl font-bold text-slate-100"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  ušetřeno díky držení &gt; 3 roky dle § 4 ZDP
                </div>
              </div>
            </div>

            {/* 3. Nejbližší odemčení */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Nejbližší odemčení lotu</span>
              </span>
              <div className="mt-2">
                {timeTestSummary.daysToNextPortfolioUnlock !== null ? (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                      za {timeTestSummary.daysToNextPortfolioUnlock} dní
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      {timeTestSummary.nextPortfolioUnlockDate} • {timeTestSummary.nextPortfolioUnlockQuantity} ks{' '}
                      {timeTestSummary.nextPortfolioUnlockSymbol}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-semibold text-slate-400 mt-1">
                      Žádné zamčené loty
                    </div>
                    <div className="text-[11px] text-emerald-400 mt-1">
                      Všechny stávající loty jsou osvobozeny
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Search, Status filter & Grouping switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            {/* Left: Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat aktivum (např. Berkshire, S&P 500, ASML, CEZ)..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Middle: Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-slate-100 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vše ({groupingMode === 'grouped' ? timeTestSummary.groupedHoldings.length : timeTestSummary.holdings.length})
              </button>
              <button
                onClick={() => setStatusFilter('exempt')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'exempt'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Osvobozeno
              </button>
              <button
                onClick={() => setStatusFilter('locked')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'locked'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                V testu
              </button>
            </div>

            {/* Right: Grouping Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium shrink-0">
              <button
                onClick={() => setGroupingMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  groupingMode === 'grouped'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Sloučit stejná aktiva napříč všemi brokery do jedné položky (např. Berkshire celkem)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Seskupeno napříč brokery</span>
              </button>
              <button
                onClick={() => setGroupingMode('individual')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  groupingMode === 'individual'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Zobrazit každou pozici odděleně podle broker účtu"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Po účtech</span>
              </button>
            </div>
          </div>

          {/* GROUPED TABLE (Across all brokers) */}
          {groupingMode === 'grouped' ? (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Aktivum (napříč brokery)</th>
                      <th className="px-4 py-3 text-right">Celkem ks</th>
                      <th className="px-4 py-3 text-right">Osvobozeno (&gt;3 roky)</th>
                      <th className="px-4 py-3 text-right">V testu (&lt;3 roky)</th>
                      <th className="px-4 py-3">Stav testu</th>
                      <th className="px-4 py-3 text-right">Osvobozená hodnota</th>
                      <th className="px-4 py-3 text-right">Ušetřená daň (15 %)</th>
                      <th className="px-4 py-3 text-right">Další odemčení</th>
                      <th className="px-3 py-3 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredGrouped.map((g) => {
                      const isFullyExempt = g.exemptPercentage >= 99.9;
                      const isPartiallyExempt = g.exemptPercentage > 0 && !isFullyExempt;
                      const isExpanded = expandedTicker === g.canonicalTicker;

                      return (
                        <React.Fragment key={g.canonicalTicker}>
                          <tr
                            onClick={() => setExpandedTicker(isExpanded ? null : g.canonicalTicker)}
                            className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                          >
                            {/* 1. Asset & Broker Badges */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-mono font-bold text-xs text-indigo-400 shrink-0">
                                  {g.canonicalTicker.slice(0, 3)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-200 text-sm">
                                      {g.canonicalTicker}
                                    </span>
                                    {g.brokers.map((b) => (
                                      <span
                                        key={b.accountId}
                                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                                        title={`${b.accountName}: ${b.totalQuantity} ks celkem (${b.exemptQuantity} ks osvobozeno)`}
                                      >
                                        {b.brokerId}: {b.totalQuantity} ks
                                      </span>
                                    ))}
                                  </div>
                                  <TruncatedTextWithTooltip
                                    text={g.name}
                                    subtext={g.isin ? `ISIN: ${g.isin}` : undefined}
                                    maxWidthClass="max-w-[180px] sm:max-w-[240px]"
                                    className="text-[11px] text-slate-400 mt-0.5"
                                  />
                                </div>
                              </div>
                            </td>

                            {/* 2. Total quantity */}
                            <td className="px-4 py-3 text-right text-slate-200 font-semibold text-sm">
                              {g.totalQuantity.toLocaleString('cs-CZ')} ks
                            </td>

                            {/* 3. Exempt quantity */}
                            <td className="px-4 py-3 text-right font-bold text-sm">
                              <span
                                className={
                                  isFullyExempt
                                    ? 'text-emerald-400'
                                    : isPartiallyExempt
                                    ? 'text-amber-400'
                                    : 'text-slate-500'
                                }
                              >
                                {g.exemptQuantity.toLocaleString('cs-CZ')} ks
                              </span>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {g.exemptPercentage}%
                              </span>
                            </td>

                            {/* 4. Locked quantity */}
                            <td className="px-4 py-3 text-right text-slate-400 font-medium">
                              {g.lockedQuantity > 0 ? `${g.lockedQuantity.toLocaleString('cs-CZ')} ks` : '0 ks'}
                            </td>

                            {/* 5. Status Progress Bar */}
                            <td className="px-4 py-3 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isFullyExempt
                                        ? 'bg-emerald-500'
                                        : isPartiallyExempt
                                        ? 'bg-amber-500'
                                        : 'bg-slate-700'
                                    }`}
                                    style={{ width: `${Math.min(100, g.exemptPercentage)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold shrink-0">
                                  {g.exemptPercentage}%
                                </span>
                              </div>
                            </td>

                            {/* 6. Exempt Market Value */}
                            <td className="px-4 py-3 text-right">
                              <MoneyDisplay
                                amount={g.exemptMarketValueTarget}
                                currency={displayCurrency}
                                className={`font-semibold ${
                                  isFullyExempt
                                    ? 'text-emerald-400'
                                    : isPartiallyExempt
                                    ? 'text-amber-400'
                                    : 'text-slate-500'
                                }`}
                              />
                            </td>

                            {/* 7. Tax saved */}
                            <td className="px-4 py-3 text-right text-slate-300 font-medium">
                              {g.estimatedTaxSavedTarget > 0 ? (
                                <MoneyDisplay
                                  amount={g.estimatedTaxSavedTarget}
                                  currency={displayCurrency}
                                  className="text-slate-200 font-semibold"
                                />
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            {/* 8. Next unlock */}
                            <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
                              {g.daysToNextUnlock !== null ? (
                                <span className="text-amber-300/90 font-medium">
                                  za {g.daysToNextUnlock} d ({g.nextUnlockQuantity} ks)
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-medium flex items-center justify-end gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>splněno</span>
                                </span>
                              )}
                            </td>

                            {/* 9. Expand Chevron */}
                            <td className="px-3 py-3 text-center text-slate-500">
                              <button className="p-1 rounded hover:bg-slate-800 text-slate-400 transition-colors">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDED ACCORDION: Broker breakdown & Chronological Lots */}
                          {isExpanded && (
                            <tr className="bg-slate-950/70 border-b border-slate-800/80">
                              <td colSpan={9} className="p-4 sm:p-5">
                                <div className="space-y-4">
                                  {/* A: Broker Accounts Breakdown */}
                                  <div>
                                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>Rozpad podle účtů a brokerů pro {g.name}</span>
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                      {g.brokers.map((b) => (
                                        <div
                                          key={b.accountId}
                                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-xs text-slate-200">
                                              {b.brokerId}
                                            </span>
                                            <span
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                b.exemptPercentage >= 99.9
                                                  ? 'bg-emerald-500/15 text-emerald-400'
                                                  : b.exemptPercentage > 0
                                                  ? 'bg-amber-500/15 text-amber-400'
                                                  : 'bg-slate-800 text-slate-500'
                                              }`}
                                            >
                                              {b.exemptPercentage}% osvobozeno
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 truncate">{b.accountName}</p>
                                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                                            <span className="text-slate-400">Celkem: <strong className="text-slate-200">{b.totalQuantity} ks</strong></span>
                                            <span className="text-emerald-400 font-semibold">{b.exemptQuantity} ks volné</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* B: Chronological Lots Table (FIFO) */}
                                  <div>
                                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Nákupní loty podle data nabytí (chronologicky FIFO, celkem {g.lots.length} nákupů)</span>
                                    </h5>
                                    <div className="rounded-xl border border-slate-800 overflow-hidden max-h-72 overflow-y-auto">
                                      <table className="w-full text-left text-[11px] font-mono">
                                        <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                                          <tr>
                                            <th className="px-3 py-2">Datum nákupu</th>
                                            <th className="px-3 py-2">Broker</th>
                                            <th className="px-3 py-2 text-right">Počet ks</th>
                                            <th className="px-3 py-2 text-right">Nákupní cena</th>
                                            <th className="px-3 py-2 text-right">Tržní hodnota</th>
                                            <th className="px-3 py-2 text-right">Zisk / Ztráta</th>
                                            <th className="px-3 py-2 text-right">Konec 3letého testu</th>
                                            <th className="px-3 py-2 text-center">Daňový status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                          {g.lots.map((lot) => {
                                            const buyDateStr = new Date(lot.openDateUtc).toLocaleDateString('cs-CZ');
                                            const exemptDateStr = new Date(lot.exemptDate).toLocaleDateString('cs-CZ');

                                            return (
                                              <tr
                                                key={lot.ticketId}
                                                className={`transition-colors ${
                                                  lot.isExempt
                                                    ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
                                                    : 'hover:bg-slate-900/50'
                                                }`}
                                              >
                                                <td className="px-3 py-2 text-slate-300 font-medium">
                                                  {buyDateStr}
                                                </td>
                                                <td className="px-3 py-2 text-slate-400">
                                                  {lot.brokerId}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-200 font-bold">
                                                  {lot.quantity.toLocaleString('cs-CZ')} ks
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-400">
                                                  <MoneyDisplay amount={lot.openPrice} currency={lot.instrumentCurrency} />
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-200">
                                                  <MoneyDisplay amount={lot.marketValueTarget} currency={displayCurrency} />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <MoneyDisplay
                                                    amount={lot.gainTarget}
                                                    currency={displayCurrency}
                                                    showSign
                                                    className={lot.gainTarget >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}
                                                  />
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-300">
                                                  {exemptDateStr}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                  {lot.isExempt ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                                      <CheckCircle2 className="w-3 h-3" />
                                                      <span>Osvobozeno</span>
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-medium">
                                                      <Clock className="w-3 h-3" />
                                                      <span>za {lot.daysToUnlock} d</span>
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* FLAT TABLE (Per broker account) */
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Instrument</th>
                      <th className="px-4 py-3 text-right">Celkem ks</th>
                      <th className="px-4 py-3 text-right">Osvobozeno (&gt;3 roky)</th>
                      <th className="px-4 py-3">Stav testu</th>
                      <th className="px-4 py-3 text-right">Osvobozená hodnota</th>
                      <th className="px-4 py-3 text-right">Ušetřená daň (15 %)</th>
                      <th className="px-4 py-3 text-right">Další odemčení</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredFlat.map((h) => {
                      const isFullyExempt = h.exemptPercentage >= 99.9;
                      const isPartiallyExempt = h.exemptPercentage > 0 && !isFullyExempt;

                      return (
                        <tr key={h.holdingId} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200">{h.symbol}</span>
                              <TruncatedTextWithTooltip
                                text={h.name}
                                maxWidthClass="max-w-[140px] sm:max-w-[200px]"
                                className="text-[11px] text-slate-400"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-300 font-medium">
                            {h.totalQuantity.toLocaleString('cs-CZ')} ks
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">
                            <span
                              className={
                                isFullyExempt
                                  ? 'text-emerald-400'
                                  : isPartiallyExempt
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }
                            >
                              {h.exemptQuantity.toLocaleString('cs-CZ')} ks
                            </span>
                          </td>
                          <td className="px-4 py-2.5 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isFullyExempt
                                      ? 'bg-emerald-500'
                                      : isPartiallyExempt
                                      ? 'bg-amber-500'
                                      : 'bg-slate-700'
                                  }`}
                                  style={{ width: `${Math.min(100, h.exemptPercentage)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold shrink-0">
                                {h.exemptPercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <MoneyDisplay
                              amount={h.exemptMarketValueTarget}
                              currency={displayCurrency}
                              className={`font-semibold ${
                                isFullyExempt
                                  ? 'text-emerald-400'
                                  : isPartiallyExempt
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-300">
                            {h.estimatedTaxSavedTarget > 0 ? (
                              <MoneyDisplay
                                amount={h.estimatedTaxSavedTarget}
                                currency={displayCurrency}
                                className="text-slate-200"
                              />
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-400 text-[11px]">
                            {h.daysToNextUnlock !== null ? (
                              <span className="text-amber-300/90 font-medium">
                                za {h.daysToNextUnlock} d ({h.nextUnlockQuantity} ks)
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-medium flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>splněno</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Buy-Only Cash Rebalancing Calculator */
        <div className="flex flex-col gap-4 mt-5">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-200">
                Dorovnání novým vkladem (KKT Water-filling)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Doporučuje nákupy podvážených aktiv bez nutnosti prodeje
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Vklad:</span>
              <input
                type="number"
                value={inflowCash}
                onChange={(e) => setInflowCash(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-slate-100 text-right focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rebalanceOrders.map((order) => {
              const isReceiving = order.cashToAdd > 0;
              return (
                <div
                  key={order.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isReceiving
                      ? 'bg-indigo-950/20 border-indigo-500/40'
                      : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-xs text-slate-200 truncate">{order.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isReceiving
                          ? 'bg-indigo-500/20 text-indigo-300 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isReceiving ? 'Koupit' : 'Držet'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">Doporučeno:</span>
                    <MoneyDisplay
                      amount={order.cashToAdd}
                      currency={displayCurrency}
                      className="font-mono font-bold text-sm text-indigo-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
