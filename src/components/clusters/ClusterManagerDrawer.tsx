import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, FolderKanban, ArrowRight, Check } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';

export const ClusterManagerDrawer: React.FC = () => {
  const holdings = usePortfolioStore((s) => s.holdings);
  const clusters = usePortfolioStore((s) => s.clusters);
  const rules = usePortfolioStore((s) => s.rules);
  const moveHoldingToCluster = usePortfolioStore((s) => s.moveHoldingToCluster);
  const saveAutoRule = usePortfolioStore((s) => s.saveAutoRule);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const getValuations = usePortfolioStore((s) => s.getValuations);

  const valuations = getValuations(displayCurrency);
  const [newClusterName, setNewClusterName] = useState('');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);

  // Group holdings by cluster
  const clusterGroups = clusters.map(c => {
    const clusterHoldings = valuations.filter(v => v.holding.clusterId === c.id);
    const totalVal = clusterHoldings.reduce((sum, v) => sum + v.marketValueTarget, 0);
    return {
      cluster: c,
      holdings: clusterHoldings,
      totalVal,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Klastry a automatické shlukování</h3>
            <p className="text-xs text-slate-400">
              Sloučení ekvivalentních ETF (např. SXR8 i VUAA pod S&P 500) a správa pravidel
            </p>
          </div>
        </div>

        {/* Create rule prompt */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {rules.length} aktivních auto-pravidel
          </span>
        </div>
      </div>

      {/* Clusters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusterGroups.map(({ cluster, holdings: cHoldings, totalVal }) => (
          <div
            key={cluster.id}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-800/80"
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cluster.color }} />
                  <h4 className="font-bold text-sm text-slate-100">{cluster.name}</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {cHoldings.length} {cHoldings.length === 1 ? 'pozice' : 'pozic'}
                </span>
              </div>

              <div className="mt-1 mb-4">
                <MoneyDisplay amount={totalVal} className="text-base font-bold text-slate-100" />
              </div>

              {/* Holding items inside cluster */}
              <div className="flex flex-col gap-1.5 min-h-[90px] p-2 rounded-xl bg-slate-950/40 border border-slate-800/40">
                {cHoldings.length === 0 ? (
                  <div className="text-[11px] text-slate-500 text-center py-4">Žádné přiřazené instrumenty</div>
                ) : (
                  cHoldings.map((h) => (
                    <div
                      key={h.holding.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-xs font-mono"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 mr-2">
                        <span className="font-bold text-slate-200">{h.holding.rawTicker}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{h.holding.name}</span>
                      </div>
                      <MoneyDisplay amount={h.marketValueTarget} className="text-[11px] font-semibold text-slate-300" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick re-assign dropdown */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500">Přiřadit aktivum:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    moveHoldingToCluster(e.target.value, cluster.id);
                  }
                }}
                defaultValue=""
                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
              >
                <option value="" disabled>Vybrat aktivum...</option>
                {valuations.map((v) => (
                  <option key={v.holding.id} value={v.holding.id}>
                    {v.holding.rawTicker} ({v.holding.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
