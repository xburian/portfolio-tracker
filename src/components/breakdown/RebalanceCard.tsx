import React, { useState, useMemo } from 'react';
import { Scale, Sparkles, ArrowRight } from 'lucide-react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { RebalanceService, RebalanceTarget } from '@/lib/services/rebalanceService';

interface RebalanceCardProps {
  valuations: ValuationDetail[];
}

export const RebalanceCard: React.FC<RebalanceCardProps> = ({ valuations }) => {
  const [inflowCash, setInflowCash] = useState<number>(20000);

  // Group by cluster or benchmark for rebalancing
  const clusterMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number }>();
    for (const v of valuations) {
      const key = v.holding.benchmark || v.holding.tags[0] || v.holding.name;
      if (!map.has(key)) {
        map.set(key, { id: key, name: key, value: 0 });
      }
      map.get(key)!.value += v.marketValueTarget;
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [valuations]);

  // Target weights: equal or proportional
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});

  const targets: RebalanceTarget[] = useMemo(() => {
    const totalCount = clusterMap.length;
    if (totalCount === 0) return [];

    return clusterMap.map(c => {
      const defaultWeight = 1 / totalCount;
      const targetWeight = customWeights[c.id] !== undefined ? customWeights[c.id] : defaultWeight;
      return {
        id: c.id,
        name: c.name,
        currentValue: c.value,
        targetWeight,
      };
    });
  }, [clusterMap, customWeights]);

  const rebalanceOrders = useMemo(() => {
    if (targets.length === 0 || inflowCash <= 0) return [];
    return RebalanceService.calculateBuyOnly(targets, inflowCash);
  }, [targets, inflowCash]);

  if (valuations.length === 0) return null;

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Tax-Free Buy-Only Rebalancing</h3>
            <p className="text-xs text-slate-400">Rebalancování novým vkladem bez nutnosti prodeje aktiv a placení daní</p>
          </div>
        </div>

        {/* Inflow cash input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Nový vklad:</span>
          <input
            type="number"
            value={inflowCash}
            onChange={(e) => setInflowCash(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-32 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono font-semibold text-slate-100 text-right focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Orders list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
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
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isReceiving ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  {isReceiving ? 'Koupit' : 'Držet'}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Alokovat:</span>
                <MoneyDisplay
                  amount={order.cashToAdd}
                  className={`text-sm font-bold font-mono ${isReceiving ? 'text-indigo-400' : 'text-slate-500'}`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>Aktuální váha: {(order.currentWeight * 100).toFixed(1)}%</span>
                <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                <span>Nová váha: {(order.postWeight * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
