import React, { useState } from 'react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { DividendService } from '@/lib/services/dividendService';
import { DividendPeriod } from '@/types/dividend';
import {
  BadgePercent,
  DollarSign,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  Search,
  Filter,
  TrendingUp,
  Clock,
  CalendarRange,
  ChevronRight,
} from 'lucide-react';

export const DividendsView: React.FC = () => {
  const allDividends = usePortfolioStore((s) => s.getDividends());
  const holdings = usePortfolioStore((s) => s.holdings);
  const lots = usePortfolioStore((s) => s.lots);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const formatCurrency = useCurrencyStore((s) => s.formatCurrency);

  const [search, setSearch] = useState('');
  const [selectedHolding, setSelectedHolding] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<DividendPeriod>('ALL');

  // Compute available years and annual aggregates from all dividends
  const availableYears = DividendService.getAvailableYears(allDividends);
  const annualAggregates = DividendService.aggregateByYear(allDividends);

  // Filter dividends by active period
  const periodDividends = DividendService.filterByPeriod(allDividends, selectedPeriod);
  const periodSummary = DividendService.calculateOverallSummary(periodDividends);
  const periodMonthlyAggregates = DividendService.aggregateByMonth(periodDividends);
  const periodHoldingAggregates = DividendService.aggregateByHolding(periodDividends, holdings, lots);

  // Filter for search & selected stock
  const filteredDividends = periodDividends.filter(d => {
    const matchesSearch = d.rawTicker.toLowerCase().includes(search.toLowerCase()) ||
      d.normalizedTicker.toLowerCase().includes(search.toLowerCase()) ||
      (d.comment && d.comment.toLowerCase().includes(search.toLowerCase()));
    const matchesHolding = selectedHolding ? d.normalizedTicker === selectedHolding : true;
    return matchesSearch && matchesHolding;
  });

  // Calculate highest monthly amount for bar chart scaling
  const maxMonthlyNet = Math.max(1, ...periodMonthlyAggregates.map(m => m.totalNetCZK));

  const getPeriodLabel = (period: DividendPeriod): string => {
    if (period === 'ALL') return 'Celé období (vše)';
    if (period === 'YTD') return `Tento rok (${new Date().getFullYear()} YTD)`;
    if (period === '1Y') return 'Posledních 12 měsíců (1Y)';
    if (period === '3Y') return 'Poslední 3 roky (3Y)';
    return `Kalendářní rok ${period}`;
  };

  return (
    <div className="space-y-6">
      {/* 0. Období & Rychlé filtry (Vše, YTD, 1Y, Roky) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <CalendarRange className="w-4 h-4 text-indigo-400" />
          <span>Filtrovat dividendy za období:</span>
          <span className="text-indigo-400 font-mono text-[11px] font-normal ml-1">
            ({getPeriodLabel(selectedPeriod)})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setSelectedPeriod('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedPeriod === 'ALL'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Celá historie
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod('YTD')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedPeriod === 'YTD'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tento rok (YTD)
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod('1Y')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedPeriod === '1Y'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Posledních 12M
          </button>

          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedPeriod(yr)}
              className={`px-2.5 py-1.5 rounded-lg font-mono font-medium transition-all ${
                selectedPeriod === yr
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Roční přehledy (Annual Breakdown Cards) */}
      {annualAggregates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Přehled dividend po jednotlivých letech (kliknutím vyfiltrujete):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Meziroční růst (YoY)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {annualAggregates.map((yr) => {
              const isActive = selectedPeriod === yr.year;
              return (
                <button
                  key={yr.year}
                  type="button"
                  onClick={() => setSelectedPeriod(isActive ? 'ALL' : yr.year)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-white font-mono flex items-center gap-1">
                      <span>Rok {yr.year}</span>
                      {yr.isYTD && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-sans uppercase">
                          YTD
                        </span>
                      )}
                    </span>
                    {yr.yoyGrowthPercent !== undefined && (
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          yr.yoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {yr.yoyGrowthPercent >= 0 ? `+${yr.yoyGrowthPercent}%` : `${yr.yoyGrowthPercent}%`}
                      </span>
                    )}
                  </div>

                  <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
                    {formatCurrency(yr.totalNetCZK, displayCurrency)}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/60">
                    <span>Ø {formatCurrency(yr.monthlyAverageCZK, displayCurrency)}/m</span>
                    <span>{yr.transactionsCount} výplat</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Horní souhrnná KPI lišta pro vybrané období */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {selectedPeriod === 'ALL'
                ? 'Celkem vyplaceno (Čisté)'
                : selectedPeriod === 'YTD'
                ? 'Vyplaceno letos (YTD čisté)'
                : selectedPeriod === '1Y'
                ? 'Vyplaceno za 12M (Čisté)'
                : `Vyplaceno v ${selectedPeriod} (Čisté)`}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BadgePercent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {formatCurrency(periodSummary.totalNetCZK, displayCurrency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hrubá dividenda: {formatCurrency(periodSummary.totalGrossCZK, displayCurrency)}
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Měsíční průměr (období)</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {formatCurrency(periodSummary.avgMonthlyNetCZK, displayCurrency)} <span className="text-xs font-normal text-slate-400">/ měs</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aktivních výplatních měsíců: {periodMonthlyAggregates.length}
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sražená daň (WHT)</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-400">
            -{formatCurrency(periodSummary.totalTaxCZK, displayCurrency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Efektivní daňová sazba: <strong className="text-slate-200">{periodSummary.effectiveTaxRate.toFixed(1)} %</strong>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Počet plateb v období</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {periodSummary.count}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Platící tituly v období: {periodHoldingAggregates.length} pozic
          </p>
        </div>
      </div>

      {/* 3. Měsíční sloupcový graf vývoje dividend pro vybrané období */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">Měsíční vývoj dividendového příjmu</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Čistý pasivní příjem připsaný v jednotlivých měsících ({getPeriodLabel(selectedPeriod)})
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full">
            {periodMonthlyAggregates.length} měsíců s výplatou
          </span>
        </div>

        {periodMonthlyAggregates.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            V tomto období nebyly zaznamenány žádné dividendové platby.
          </div>
        ) : (
          <div className="h-64 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-4 pt-6 scrollbar-none">
            {periodMonthlyAggregates.map((m) => {
              const heightPct = Math.max(6, Math.round((m.totalNetCZK / maxMonthlyNet) * 100));
              return (
                <div key={m.yearMonth} className="flex-1 min-w-[42px] max-w-[70px] flex flex-col items-center gap-2 group">
                  <div className="w-full bg-slate-800/80 rounded-t-lg relative flex items-end overflow-hidden h-44">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all duration-300 group-hover:from-emerald-500 group-hover:to-teal-300"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors">
                    {formatCurrency(m.totalNetCZK, displayCurrency)}
                  </span>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {m.yearMonth.substring(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Dividendoví plátci & Detailní transakční tabulka */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Levý panel: Žebříček dividendových plátců a Yield on Cost */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Top plátci v období</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {getPeriodLabel(selectedPeriod)}
              </p>
            </div>
            <span className="text-xs text-slate-400">{periodHoldingAggregates.length} titulů</span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {periodHoldingAggregates.map((h) => {
              const isSelected = selectedHolding === h.normalizedTicker;
              return (
                <button
                  key={h.normalizedTicker}
                  onClick={() => setSelectedHolding(isSelected ? null : h.normalizedTicker)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md'
                      : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">{h.normalizedTicker}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{h.name}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {formatCurrency(h.totalNetCZK, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Daň: {h.effectiveTaxRate.toFixed(1)} %</span>
                    {h.yieldOnCost > 0 && (
                      <span className="text-indigo-400 font-medium">YoC: {h.yieldOnCost.toFixed(2)} %</span>
                    )}
                  </div>
                </button>
              );
            })}

            {periodHoldingAggregates.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                V tomto období nebyly vyplaceny žádné dividendy.
              </div>
            )}
          </div>
        </div>

        {/* Pravý panel: Detailní transakční log */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Transakční historie dividend</h3>
                <p className="text-xs text-slate-400">
                  {selectedHolding
                    ? `Filtrováno pro: ${selectedHolding} (${getPeriodLabel(selectedPeriod)})`
                    : `Připsané dividendy a daň (${getPeriodLabel(selectedPeriod)})`}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Hledat ticker..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {selectedHolding && (
                  <button
                    onClick={() => setSelectedHolding(null)}
                    className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Zrušit ticker
                  </button>
                )}
                {selectedPeriod !== 'ALL' && (
                  <button
                    onClick={() => setSelectedPeriod('ALL')}
                    className="text-xs px-2.5 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30"
                  >
                    Zrušit období
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Datum</th>
                    <th className="py-2.5 px-3">Ticker</th>
                    <th className="py-2.5 px-3">Broker</th>
                    <th className="py-2.5 px-3 text-right">Hrubá</th>
                    <th className="py-2.5 px-3 text-right">Daň (WHT)</th>
                    <th className="py-2.5 px-3 text-right">Čistá výplata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredDividends.slice(0, 50).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {d.paymentDateUtc ? d.paymentDateUtc.substring(0, 10) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                        {d.normalizedTicker}
                        {d.rawTicker !== d.normalizedTicker && (
                          <span className="text-[10px] text-slate-500 ml-1.5">({d.rawTicker})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300">
                          {d.brokerId}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">
                        {d.grossAmount.toFixed(2)} {d.currency}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-400 whitespace-nowrap">
                        -{d.withholdingTax.toFixed(2)} {d.currency}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                        +{d.netAmount.toFixed(2)} {d.currency}
                        {d.currency !== displayCurrency && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            (~{formatCurrency(d.netAmountCZK, displayCurrency)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDividends.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nebyly nalezeny žádné dividendové transakce pro vybrané období a filtr.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex justify-between items-center">
            <span>
              Zobrazeno {Math.min(50, filteredDividends.length)} z {filteredDividends.length} plateb
              {selectedPeriod !== 'ALL' && ` v období ${getPeriodLabel(selectedPeriod)}`}
            </span>
            <span>Dividendy jsou automaticky párovány ze srážkové daně brokera</span>
          </div>
        </div>
      </div>
    </div>
  );
};
