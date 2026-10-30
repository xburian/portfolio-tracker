import React from 'react';
import { Search, Filter, X, Coins } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

interface QuickFilterBarProps {
  onOpenCashManager?: () => void;
}

export const QuickFilterBar: React.FC<QuickFilterBarProps> = ({ onOpenCashManager }) => {
  const accounts = usePortfolioStore((s) => s.accounts);
  const clusters = usePortfolioStore((s) => s.clusters);
  
  const selectedAccountFilter = usePortfolioStore((s) => s.selectedAccountFilter);
  const setAccountFilter = usePortfolioStore((s) => s.setAccountFilter);
  
  const selectedClusterFilter = usePortfolioStore((s) => s.selectedClusterFilter);
  const setClusterFilter = usePortfolioStore((s) => s.setClusterFilter);
  
  const searchQuery = usePortfolioStore((s) => s.searchQuery);
  const setSearchQuery = usePortfolioStore((s) => s.setSearchQuery);

  const hasActiveFilters = Boolean(selectedAccountFilter || selectedClusterFilter || searchQuery);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hledat ticker, název, ISIN, brokera (Portu, XTB, Degiro), měnu..."
          className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Select Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {/* Account Filter */}
        {accounts.length > 1 && (
          <select
            value={selectedAccountFilter || ''}
            onChange={(e) => setAccountFilter(e.target.value || null)}
            className={`px-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:border-indigo-500 font-medium transition-colors ${
              selectedAccountFilter
                ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-semibold'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <option value="">Všechny účty ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        )}

        {/* Cluster Filter */}
        {clusters.length > 0 && (
          <select
            value={selectedClusterFilter || ''}
            onChange={(e) => setClusterFilter(e.target.value || null)}
            className={`px-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:border-indigo-500 font-medium transition-colors ${
              selectedClusterFilter
                ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-semibold'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <option value="">Všechny skupiny</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Manage Cash Button */}
        {onOpenCashManager && (
          <button
            onClick={onOpenCashManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all shrink-0"
            title="Spravovat a upravit volnou hotovost na účtech"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Hotovost</span>
          </button>
        )}

        {/* Reset filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setAccountFilter(null);
              setClusterFilter(null);
              setSearchQuery('');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors shrink-0"
          >
            <Filter className="w-3 h-3 text-indigo-400" />
            <span>Reset filtrů</span>
          </button>
        )}
      </div>
    </div>
  );
};
