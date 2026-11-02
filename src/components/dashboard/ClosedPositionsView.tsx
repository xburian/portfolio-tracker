import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Clock,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Percent,
  ArrowUpDown,
  Coins,
  FileSpreadsheet,
} from 'lucide-react';
import { ClosedPosition, CurrencyCode } from '@/types/portfolio';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { CurrencyService } from '@/lib/services/currencyService';

type TaxFilterType = 'ALL' | 'TAX_EXEMPT' | 'TAXABLE' | 'WINNERS' | 'LOSERS';
type SortField = 'closeDate' | 'profit' | 'holdingDays' | 'ticker';

export const ClosedPositionsView: React.FC = () => {
  const getClosedPositions = usePortfolioStore((s) => s.getClosedPositions);
  const getClosedPositionsSummary = usePortfolioStore((s) => s.getClosedPositionsSummary);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const [search, setSearch] = useState('');
  const [taxFilter, setTaxFilter] = useState<TaxFilterType>('ALL');
  const [sortField, setSortField] = useState<SortField>('closeDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const positions = useMemo(() => getClosedPositions(), [getClosedPositions]);
  const summary = useMemo(() => getClosedPositionsSummary(displayCurrency), [getClosedPositionsSummary, displayCurrency]);

  const filteredPositions = useMemo(() => {
    let list = [...positions];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.normalizedTicker.toLowerCase().includes(q) ||
          p.rawTicker.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }

    // Filter by type
    if (taxFilter === 'TAX_EXEMPT') {
      list = list.filter((p) => p.isTimeTestExempt);
    } else if (taxFilter === 'TAXABLE') {
      list = list.filter((p) => !p.isTimeTestExempt && p.profitNative > 0);
    } else if (taxFilter === 'WINNERS') {
      list = list.filter((p) => p.profitNative > 0);
    } else if (taxFilter === 'LOSERS') {
      list = list.filter((p) => p.profitNative < 0);
    }

    // Sort
    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'closeDate') {
        diff = new Date(a.closeDateUtc).getTime() - new Date(b.closeDateUtc).getTime();
      } else if (sortField === 'profit') {
        const pA = CurrencyService.convert(a.profitNative, a.instrumentCurrency, displayCurrency);
        const pB = CurrencyService.convert(b.profitNative, b.instrumentCurrency, displayCurrency);
        diff = pA - pB;
      } else if (sortField === 'holdingDays') {
        diff = (a.holdingPeriodDays || 0) - (b.holdingPeriodDays || 0);
      } else if (sortField === 'ticker') {
        diff = a.normalizedTicker.localeCompare(b.normalizedTicker);
      }
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [positions, search, taxFilter, sortField, sortAsc, displayCurrency]);

  const totalPages = Math.max(1, Math.ceil(filteredPositions.length / pageSize));
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPositions.slice(start, start + pageSize);
  }, [filteredPositions, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Celkový realizovaný zisk */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Realizovaný zisk</span>
            <Coins className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span
              className={`text-lg font-bold font-mono ${
                summary.totalRealizedProfitTarget >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <MoneyDisplay amount={summary.totalRealizedProfitTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Z {summary.totalTradesCount} uzavřených pozic
            </p>
          </div>
        </div>

        {/* 2. Win Rate % & Profit Factor */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Win Rate & Profit Factor</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-100">
                {summary.winRatePercent.toFixed(1)} %
              </span>
              <span className="text-xs font-mono text-cyan-300">
                PF {summary.profitFactor >= 999 ? '∞' : summary.profitFactor.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.winningTradesCount} ziskových / {summary.losingTradesCount} ztrátových
            </p>
          </div>
        </div>

        {/* 3. Průměrný zisk / ztráta */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Průměrný zisk vs ztráta</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400">
                +<MoneyDisplay amount={summary.avgWinningTradeTarget} currency={displayCurrency} />
              </span>
              <span className="text-xs font-mono text-rose-400">
                -<MoneyDisplay amount={summary.avgLosingTradeTarget} currency={displayCurrency} />
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Poměr RRR:{' '}
              {summary.avgLosingTradeTarget > 0
                ? (summary.avgWinningTradeTarget / summary.avgLosingTradeTarget).toFixed(2)
                : '—'}
            </p>
          </div>
        </div>

        {/* 4. Časový test § 4 ZDP Ušetřená daň */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ušetřená daň § 4 ZDP</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-emerald-400">
              +<MoneyDisplay amount={summary.totalTaxSavedTarget} currency={displayCurrency} />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.taxExemptTradesCount} pozic po 3 letech (0% daň)
            </p>
          </div>
        </div>

        {/* 5. Průměrná doba držení */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Doba držení</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-100">
              {summary.avgHoldingPeriodDays} dní
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ~{(summary.avgHoldingPeriodDays / 365.25).toFixed(1)} roku průměrně
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Hledat ticker, název akcie nebo ETF..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs overflow-x-auto">
          {[
            { id: 'ALL', label: 'Všechny obchody' },
            { id: 'TAX_EXEMPT', label: '🛡️ Osvobozeno (§ 4 ZDP)' },
            { id: 'TAXABLE', label: '⚠️ Zdanitelné' },
            { id: 'WINNERS', label: '🟢 Ziskové' },
            { id: 'LOSERS', label: '🔴 Ztrátové' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setTaxFilter(f.id as TaxFilterType);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all text-xs font-medium ${
                taxFilter === f.id
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Closed Positions */}
      <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
              <th
                className="py-3 px-3 cursor-pointer hover:text-slate-200"
                onClick={() => toggleSort('ticker')}
              >
                <div className="flex items-center gap-1">
                  <span>Instrument</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-2 text-center">Broker</th>
              <th className="py-3 px-2 text-right">Objem</th>
              <th className="py-3 px-2 text-right">Nákup</th>
              <th className="py-3 px-2 text-right">Prodej</th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-slate-200 text-center"
                onClick={() => toggleSort('holdingDays')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Držení</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-slate-200 text-right"
                onClick={() => toggleSort('profit')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Realizovaný zisk</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-slate-200 text-right"
                onClick={() => toggleSort('closeDate')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Datum uzavření</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3 text-center">Daňový status § 4</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {paginatedPositions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                  Nebyly nalezeny žádné uzavřené pozice odpovídající zadaným filtrům.
                </td>
              </tr>
            ) : (
              paginatedPositions.map((pos) => {
                const profitDisplay = CurrencyService.convert(
                  pos.profitNative,
                  pos.instrumentCurrency,
                  displayCurrency
                );
                const isPositive = pos.profitNative >= 0;

                return (
                  <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Instrument */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 tracking-tight">
                          {pos.normalizedTicker}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">
                          {pos.name}
                        </span>
                      </div>
                    </td>

                    {/* Broker */}
                    <td className="py-2.5 px-2 text-center font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                        {pos.brokerId}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-2.5 px-2 text-right text-slate-300">
                      {pos.volume.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })}
                    </td>

                    {/* Open Price */}
                    <td className="py-2.5 px-2 text-right text-slate-400">
                      {pos.openPrice.toFixed(2)} {pos.instrumentCurrency}
                    </td>

                    {/* Close Price */}
                    <td className="py-2.5 px-2 text-right text-slate-200 font-semibold">
                      {pos.closePrice.toFixed(2)} {pos.instrumentCurrency}
                    </td>

                    {/* Holding Period */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-slate-300 font-semibold">{pos.holdingPeriodDays}</span>
                      <span className="text-[10px] text-slate-500 font-sans ml-1">dní</span>
                    </td>

                    {/* Realized Profit */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {isPositive ? '+' : ''}
                          <MoneyDisplay amount={profitDisplay} currency={displayCurrency} />
                        </span>
                        <span
                          className={`text-[10px] ${
                            isPositive ? 'text-emerald-500/80' : 'text-rose-500/80'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {pos.profitPercent.toFixed(1)} %
                        </span>
                      </div>
                    </td>

                    {/* Close Date */}
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                      {new Date(pos.closeDateUtc).toLocaleDateString('cs-CZ')}
                    </td>

                    {/* Tax Exemption Status */}
                    <td className="py-2.5 px-3 text-center font-sans">
                      {pos.isTimeTestExempt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          0% Daň
                        </span>
                      ) : isPositive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          15% Daň
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/40">
                          Ztráta
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Zobrazeno {Math.min(filteredPositions.length, (currentPage - 1) * pageSize + 1)}–
            {Math.min(filteredPositions.length, currentPage * pageSize)} z {filteredPositions.length} obchodů
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-300 hover:text-white"
            >
              Předchozí
            </button>
            <span className="font-mono text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-300 hover:text-white"
            >
              Další
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
