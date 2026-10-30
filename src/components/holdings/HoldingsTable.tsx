import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ShieldCheck, Coins } from 'lucide-react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DeltaBadge } from '@/components/common/DeltaBadge';
import { TruncatedTextWithTooltip } from '@/components/common/TruncatedTextWithTooltip';
import { InlineTagEditor } from './InlineTagEditor';
import { HoldingCardMobile } from './HoldingCardMobile';
import { TaxTimeTestService } from '@/lib/services/taxTimeTestService';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

interface HoldingsTableProps {
  valuations: ValuationDetail[];
}

type SortField = 'symbol' | 'name' | 'value' | 'profit' | 'profitPercent' | 'weight';
type SortDirection = 'asc' | 'desc';

export const HoldingsTable: React.FC<HoldingsTableProps> = ({ valuations }) => {
  const lots = usePortfolioStore((s) => s.lots);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-reset to page 1 on valuations count or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [valuations.length, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const sortedValuations = useMemo(() => {
    return [...valuations].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortField) {
        case 'symbol':
          valA = a.holding.rawTicker;
          valB = b.holding.rawTicker;
          break;
        case 'name':
          valA = a.holding.name;
          valB = b.holding.name;
          break;
        case 'value':
          valA = a.marketValueTarget;
          valB = b.marketValueTarget;
          break;
        case 'profit':
          valA = a.unrealizedProfitTarget;
          valB = b.unrealizedProfitTarget;
          break;
        case 'profitPercent':
          valA = a.unrealizedProfitPercent;
          valB = b.unrealizedProfitPercent;
          break;
        case 'weight':
          valA = a.weightInPortfolio;
          valB = b.weightInPortfolio;
          break;
        default:
          valA = a.marketValueTarget;
          valB = b.marketValueTarget;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [valuations, sortField, sortDirection]);

  // Pagination calculation
  const totalItems = sortedValuations.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedValuations = useMemo(() => {
    if (pageSize === 'all') return sortedValuations;
    const start = (validCurrentPage - 1) * pageSize;
    return sortedValuations.slice(start, start + pageSize);
  }, [sortedValuations, validCurrentPage, pageSize]);

  if (valuations.length === 0) {
    return (
      <div className="bg-[#0F1420] border border-slate-800 p-12 rounded-2xl text-center">
        <p className="text-sm text-slate-400">Žádná otevřená aktiva neodpovídají zadanému filtru.</p>
      </div>
    );
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400" />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile Card Stack (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        {paginatedValuations.map((v) => (
          <HoldingCardMobile key={v.holding.id} valuation={v} />
        ))}
      </div>

      {/* Desktop Grid (>= md) */}
      <div className="hidden md:block bg-[#0F1420] rounded-2xl overflow-hidden border border-slate-800/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono font-medium text-slate-400 bg-slate-900/60 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('symbol')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Aktivum</span>
                    {renderSortIcon('symbol')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('weight')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Váha</span>
                    {renderSortIcon('weight')}
                  </div>
                </th>
                <th className="py-3.5 px-4">Pozice</th>
                <th className="py-3.5 px-4">Tržní cena</th>
                <th
                  onClick={() => handleSort('value')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors group text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Tržní hodnota</span>
                    {renderSortIcon('value')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('profit')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors group text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Zisk / Ztráta</span>
                    {renderSortIcon('profit')}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Časový test</th>
                <th className="py-3.5 px-4 text-right">Štítky</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {paginatedValuations.map((v) => {
                const { holding } = v;
                const isCash = holding.assetClass === 'CASH';
                const timeStatus = isCash
                  ? { exemptPercentage: 100, exemptQuantity: v.quantity, totalQuantity: v.quantity, lockedQuantity: 0, daysToNextUnlock: null, nextUnlockQuantity: 0 }
                  : TaxTimeTestService.analyzeHolding(v, lots, displayCurrency);
                const isExempt = timeStatus.exemptPercentage >= 99.9;
                const isPartial = timeStatus.exemptPercentage > 0 && !isExempt;

                return (
                  <tr
                    key={holding.id}
                    className="hover:bg-slate-850/50 transition-colors group"
                  >
                    {/* 1. Asset Identity with Truncated Tooltip */}
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isCash
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-slate-800 border-slate-700/60 text-indigo-400'
                          }`}
                        >
                          {isCash ? <Coins className="w-4 h-4" /> : holding.rawTicker.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 font-mono text-sm">
                              {holding.rawTicker}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {holding.brokerId}
                            </span>
                            {isCash ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold">
                                HOTOVOST
                              </span>
                            ) : holding.assetClass && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 font-mono">
                                {holding.assetClass}
                              </span>
                            )}
                          </div>
                          <TruncatedTextWithTooltip
                            text={holding.name}
                            subtext={holding.isin ? `ISIN: ${holding.isin}` : undefined}
                            maxWidthClass="max-w-[200px] xl:max-w-[300px]"
                            className="text-[11px] text-slate-400 mt-0.5"
                          />
                        </div>
                      </div>
                    </td>

                    {/* 2. Weight bar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium">
                          {(v.weightInPortfolio).toFixed(1)}%
                        </span>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, v.weightInPortfolio * 2.5)}%` }}
                            className={`${isCash ? 'bg-amber-500' : 'bg-indigo-500'} h-full rounded-full`}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 3. Position (Quantity & Avg buy price) */}
                    <td className="py-3 px-4 text-slate-300">
                      <div>
                        {isCash ? (
                          <>
                            <span className="font-medium">
                              <MoneyDisplay amount={v.quantity} currency={holding.instrumentCurrency} />
                            </span>
                            <div className="text-[11px] text-slate-500 font-sans">
                              volný zůstatek
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{v.quantity} ks</span>
                            <div className="text-[11px] text-slate-500 font-sans">
                              průměr: <MoneyDisplay amount={holding.averageOpenPrice} currency={holding.instrumentCurrency} />
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* 4. Current Price */}
                    <td className="py-3 px-4">
                      <div>
                        <MoneyDisplay amount={v.currentPriceNative} currency={holding.instrumentCurrency} className="text-slate-200 font-medium" />
                        {holding.instrumentCurrency !== v.targetCurrency && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            ≈ <MoneyDisplay amount={v.currentPriceTarget} />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. Market Value Target */}
                    <td className="py-3 px-4 text-right">
                      <MoneyDisplay
                        amount={v.marketValueTarget}
                        className="text-sm font-bold text-slate-100 tracking-tight"
                      />
                    </td>

                    {/* 6. P&L */}
                    <td className="py-3 px-4 text-right">
                      {isCash ? (
                        <div className="text-slate-500 font-sans text-xs">
                          <span>0,00 Kč</span>
                          <div className="text-[10px] text-slate-600 font-mono">rezerva</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <MoneyDisplay
                            amount={v.unrealizedProfitTarget}
                            showSign
                            className={`font-semibold ${
                              v.unrealizedProfitTarget >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          />
                          <div className="mt-0.5">
                            <DeltaBadge valuePercent={v.unrealizedProfitPercent} />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 7. Czech 3-Year Time Test Badge */}
                    <td className="py-3 px-4 text-center">
                      <TruncatedTextWithTooltip
                        text={
                          isCash
                            ? 'Hotovost nepodléhá dani z příjmu z prodeje CP'
                            : isExempt
                            ? `100 % osvobozeno (${timeStatus.exemptQuantity} ks)`
                            : isPartial
                            ? `Částečně (${timeStatus.exemptQuantity} ks z ${timeStatus.totalQuantity} ks)`
                            : `V časovém testu (${timeStatus.lockedQuantity} ks)`
                        }
                        subtext={
                          isCash
                            ? 'Okamžitě k dispozici bez daňových povinností'
                            : timeStatus.daysToNextUnlock !== null
                            ? `Další odemčení za ${timeStatus.daysToNextUnlock} dní (${timeStatus.nextUnlockQuantity} ks)`
                            : 'Všechny loty splnily 3letý časový test dle § 4 ZDP'
                        }
                        maxWidthClass="max-w-[120px]"
                      >
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCash
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : isExempt
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isPartial
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>
                            {isCash
                              ? 'Hotovost'
                              : isExempt
                              ? `${timeStatus.exemptQuantity} ks (100 %)`
                              : timeStatus.exemptQuantity > 0
                              ? `${timeStatus.exemptQuantity} ks (${timeStatus.exemptPercentage} %)`
                              : '0 ks (v testu)'}
                          </span>
                        </span>
                      </TruncatedTextWithTooltip>
                    </td>

                    {/* 8. Inline tags */}
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end">
                        <InlineTagEditor holdingId={holding.id} tags={holding.tags} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-900/80 border-t border-slate-800 text-xs">
          {/* Range Info */}
          <div className="text-slate-400 font-mono">
            Zobrazeno{' '}
            <span className="font-semibold text-slate-200">
              {pageSize === 'all' ? 1 : (validCurrentPage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-semibold text-slate-200">
              {pageSize === 'all' ? totalItems : Math.min(validCurrentPage * pageSize, totalItems)}
            </span>{' '}
            z <span className="font-semibold text-slate-100">{totalItems}</span> pozic
          </div>

          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 font-sans">
              <span className="text-slate-500 text-[11px]">Na stránku:</span>
              <div className="flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700/60 font-mono">
                {[10, 25, 50, 'all'].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSize(size as any);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${
                      pageSize === size
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {size === 'all' ? 'Vše' : size}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="p-1 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono transition-colors ${
                      validCurrentPage === page
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
