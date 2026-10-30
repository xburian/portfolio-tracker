import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { PieChart as PieIcon, Layers, Filter, CheckCircle2, X } from 'lucide-react';

interface DonutAllocationProps {
  valuations: ValuationDetail[];
  variant?: 'compact' | 'full';
  className?: string;
}

export type GroupByOption = 'holding' | 'cluster' | 'assetClass' | 'currency' | 'broker';

const COLORS = [
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#EAB308', // Yellow
  '#A855F7', // Purple
  '#0284C7', // Sky
  '#D97706', // Warm Amber
  '#64748B', // Slate
];

export const DonutAllocation: React.FC<DonutAllocationProps> = ({
  valuations,
  variant = 'compact',
  className = '',
}) => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('cluster');
  const [hoveredSlice, setHoveredSlice] = useState<{ name: string; value: number; weight: number; fullName?: string } | null>(null);

  const selectedClusterFilter = usePortfolioStore((s) => s.selectedClusterFilter);
  const setClusterFilter = usePortfolioStore((s) => s.setClusterFilter);
  const searchQuery = usePortfolioStore((s) => s.searchQuery);
  const setSearchQuery = usePortfolioStore((s) => s.setSearchQuery);

  const totalValue = useMemo(() => {
    return valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
  }, [valuations]);

  const chartData = useMemo(() => {
    if (groupBy === 'holding') {
      const holdingMap = new Map<string, { id: string; name: string; fullName?: string; value: number }>();
      for (const v of valuations) {
        const isCash = v.holding.assetClass === 'CASH';
        const key = isCash ? `Hotovost (${v.holding.instrumentCurrency})` : (v.holding.rawTicker || v.holding.name);
        const fullName = v.holding.name;
        const id = isCash ? `cash_${v.holding.instrumentCurrency}` : (v.holding.rawTicker || v.holding.id);

        if (!holdingMap.has(key)) {
          holdingMap.set(key, { id, name: key, fullName, value: 0 });
        }
        holdingMap.get(key)!.value += v.marketValueTarget;
      }

      const sorted = Array.from(holdingMap.values())
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

      const maxItems = variant === 'full' ? 12 : 7;
      let items = sorted;
      if (sorted.length > maxItems) {
        const top = sorted.slice(0, maxItems);
        const rest = sorted.slice(maxItems);
        const restValue = rest.reduce((acc, curr) => acc + curr.value, 0);
        top.push({
          id: 'other_holdings',
          name: `Ostatní (${rest.length})`,
          fullName: `${rest.length} menších pozic mimo Top ${maxItems}`,
          value: restValue,
        });
        items = top;
      }

      return items.map((item, idx) => ({
        ...item,
        color: COLORS[idx % COLORS.length],
        weight: totalValue > 0 ? item.value / totalValue : 0,
      }));
    }

    const map = new Map<string, { id: string; name: string; fullName?: string; value: number }>();

    for (const v of valuations) {
      let key = 'Other';
      let id = 'other';
      let fullName = undefined;

      if (groupBy === 'cluster') {
        key = v.holding.benchmark || v.holding.tags[0] || v.holding.name;
        if (v.holding.assetClass === 'CASH') key = 'Volná hotovost';
        id = v.holding.clusterId || key;
        fullName = `Klastr / benchmark: ${key}`;
      } else if (groupBy === 'assetClass') {
        if (v.holding.assetClass === 'CASH') {
          key = 'Hotovost (Rezerva)';
        } else if (v.holding.assetClass === 'ETF') {
          key = 'ETF Fondy';
        } else if (v.holding.assetClass === 'EQUITY') {
          key = 'Akcie (Equity)';
        } else if (v.holding.assetClass === 'COMMODITY') {
          key = 'Komodity / Zlato';
        } else {
          key = v.holding.assetClass;
        }
        id = v.holding.assetClass;
      } else if (groupBy === 'currency') {
        key = v.holding.instrumentCurrency;
        id = v.holding.instrumentCurrency;
        fullName = `Měna instrumentů: ${key}`;
      } else if (groupBy === 'broker') {
        if (v.holding.brokerId === 'BANK' || v.holding.brokerId === 'CASH') {
          key = 'Banka / Hotovost';
        } else {
          key = v.holding.brokerId;
        }
        id = v.holding.brokerId;
        fullName = `Broker / Depozitář: ${key}`;
      }

      if (!map.has(key)) {
        map.set(key, { id, name: key, fullName, value: 0 });
      }
      map.get(key)!.value += v.marketValueTarget;
    }

    const items = Array.from(map.values())
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return items.map((item, idx) => ({
      ...item,
      color: COLORS[idx % COLORS.length],
      weight: totalValue > 0 ? item.value / totalValue : 0,
    }));
  }, [valuations, groupBy, totalValue, variant]);

  const handleItemClick = (item: { id: string; name: string }) => {
    if (groupBy === 'cluster') {
      setClusterFilter(selectedClusterFilter === item.id ? null : item.id);
    } else if (groupBy === 'holding') {
      if (item.id === 'other_holdings') return;
      const cleanName = item.name.replace(/Hotovost \((.*?)\)/, '$1');
      setSearchQuery(searchQuery.toLowerCase() === cleanName.toLowerCase() ? '' : cleanName);
    } else if (groupBy === 'broker') {
      const q = item.name.toLowerCase();
      setSearchQuery(searchQuery.toLowerCase() === q ? '' : q);
    } else if (groupBy === 'currency') {
      setSearchQuery(searchQuery.toLowerCase() === item.name.toLowerCase() ? '' : item.name);
    }
  };

  const isItemActive = (item: { id: string; name: string }) => {
    if (groupBy === 'cluster') return selectedClusterFilter === item.id;
    if (groupBy === 'holding' || groupBy === 'broker' || groupBy === 'currency') {
      return searchQuery.toLowerCase().includes(item.name.toLowerCase());
    }
    return false;
  };

  const hasActiveFilter = Boolean(selectedClusterFilter || searchQuery);

  const clearCurrentFilter = () => {
    if (selectedClusterFilter) setClusterFilter(null);
    if (searchQuery) setSearchQuery('');
  };

  // Switcher buttons config
  const switcherOptions: { id: GroupByOption; label: string }[] = [
    { id: 'holding', label: 'Pozice (Ticker)' },
    { id: 'cluster', label: 'Klastry / Štítky' },
    { id: 'assetClass', label: 'Třída aktiv' },
    { id: 'currency', label: 'Měny' },
    { id: 'broker', label: 'Broker' },
  ];

  if (variant === 'full') {
    return (
      <div className={`bg-[#0F1420] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col gap-6 ${className}`}>
        {/* Full Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-400" />
              <span>Rozpad alokace portfolia</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Vektorově ostrý koláčový graf alokace s interaktivním filtrem a detailním rozpadem vah
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilter && (
              <button
                onClick={clearCurrentFilter}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/20 transition-colors"
                title="Resetovat aktivní filtr"
              >
                <X className="w-3.5 h-3.5" />
                <span>Zrušit filtr</span>
              </button>
            )}

            {/* Switcher Toggle Buttons */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium overflow-x-auto">
              {switcherOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setGroupBy(opt.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    groupBy === opt.id
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Left Big Donut Chart, Right Detailed Breakdown List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Donut Chart Visual */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[340px]">
            {chartData.length === 0 ? (
              <div className="text-xs text-slate-500">Žádná data k zobrazení</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={100}
                      outerRadius={148}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, idx) => {
                        const item = chartData[idx];
                        if (item) {
                          setHoveredSlice({
                            name: item.name,
                            fullName: item.fullName,
                            value: item.value,
                            weight: item.weight,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={(entry) => handleItemClick(entry)}
                      className="cursor-pointer focus:outline-none"
                    >
                      {chartData.map((entry, index) => {
                        const active = isItemActive(entry);
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="#0F1420"
                            strokeWidth={active ? 4 : 2}
                            strokeDasharray={active ? '4 2' : undefined}
                            className="transition-all duration-200 hover:opacity-85 focus:outline-none"
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Dynamic Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider max-w-[170px] truncate">
                    {hoveredSlice ? hoveredSlice.name : 'Celkové portfolio'}
                  </span>
                  <MoneyDisplay
                    amount={hoveredSlice ? hoveredSlice.value : totalValue}
                    className="text-2xl font-bold text-slate-100 tracking-tight my-0.5"
                  />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm font-mono font-bold text-indigo-400">
                      {hoveredSlice ? `${(hoveredSlice.weight * 100).toFixed(1)}%` : '100.0%'}
                    </span>
                    {hoveredSlice && (
                      <span className="text-[10px] text-slate-400 font-medium">portfolia</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 max-w-[150px] leading-tight">
                    {hoveredSlice ? 'Klepnutím vyfiltrujete v tabulce' : 'Najetím prozkoumejte složky'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Detailed Breakdown List (Right Column) */}
          <div className="lg:col-span-7 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-3 pb-1 border-b border-slate-800/60">
              <span>Složka / Segment ({chartData.length})</span>
              <div className="flex items-center gap-6">
                <span>Hodnota</span>
                <span className="w-14 text-right">Podíl</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {chartData.map((item) => {
                const active = isItemActive(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-indigo-600/20 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/60 hover:bg-slate-800/70 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-200 truncate" title={item.fullName || item.name}>
                            {item.name}
                          </span>
                          {item.fullName && item.fullName !== item.name && (
                            <span className="text-[10px] text-slate-500 truncate" title={item.fullName}>
                              {item.fullName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <MoneyDisplay
                          amount={item.value}
                          className="text-xs font-mono font-semibold text-slate-200"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-400 w-12 text-right">
                          {(item.weight * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Fill Bar */}
                    <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(1, item.weight * 100))}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact Variant (used in Dashboard sidebar)
  return (
    <div className={`glass-panel p-6 rounded-2xl flex flex-col h-full ${className}`}>
      {/* Header & Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-indigo-400" />
            <span>Rozpad alokace</span>
          </h3>
          <p className="text-xs text-slate-400">Poměr složek absolutně i v procentech</p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-medium overflow-x-auto">
          {switcherOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setGroupBy(opt.id)}
              className={`px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${
                groupBy === opt.id
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart and Center Inspect */}
      <div className="relative flex-1 min-h-[260px] flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-xs text-slate-500">Žádná data k zobrazení</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, idx) => {
                    const item = chartData[idx];
                    if (item) {
                      setHoveredSlice({ name: item.name, value: item.value, weight: item.weight });
                    }
                  }}
                  onMouseLeave={() => setHoveredSlice(null)}
                  onClick={(entry) => handleItemClick(entry)}
                  className="cursor-pointer focus:outline-none"
                >
                  {chartData.map((entry, index) => {
                    const active = isItemActive(entry);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="#0B0E14"
                        strokeWidth={active ? 3 : 2}
                        className="transition-all duration-200 hover:opacity-85 focus:outline-none"
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Dynamic Center Hole Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-2 text-center">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider max-w-[130px] truncate">
                {hoveredSlice ? hoveredSlice.name : 'Celkem'}
              </span>
              <MoneyDisplay
                amount={hoveredSlice ? hoveredSlice.value : totalValue}
                className="text-lg font-bold text-slate-100 tracking-tight"
              />
              <span className="text-xs font-mono font-semibold text-indigo-400">
                {hoveredSlice ? `${(hoveredSlice.weight * 100).toFixed(1)}%` : '100%'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800/80 max-h-[160px] overflow-y-auto">
        {chartData.map((item) => {
          const active = isItemActive(item);
          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                active ? 'bg-indigo-600/20 border border-indigo-500/40' : 'hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 mr-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 truncate font-medium text-[11px]">{item.name}</span>
              </div>
              <span className="text-slate-400 font-mono font-semibold shrink-0 text-[11px]">
                {(item.weight * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};