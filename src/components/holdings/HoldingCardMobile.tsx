import React from 'react';
import { ValuationDetail } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DeltaBadge } from '@/components/common/DeltaBadge';
import { InlineTagEditor } from './InlineTagEditor';

interface HoldingCardMobileProps {
  valuation: ValuationDetail;
}

export const HoldingCardMobile: React.FC<HoldingCardMobileProps> = ({ valuation }) => {
  const { holding } = valuation;

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md backdrop-blur-md">
      {/* Top row: Asset identity and market value */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-xs text-indigo-400">
            {holding.rawTicker.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-sm font-mono">{holding.rawTicker}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                {holding.brokerId}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[170px]">{holding.name}</p>
          </div>
        </div>

        <div className="text-right">
          <MoneyDisplay
            amount={valuation.marketValueTarget}
            className="text-sm font-bold text-slate-100 tracking-tight"
          />
          <div className="text-[10px] text-slate-500 font-mono">
            {valuation.weightInPortfolio.toFixed(1)}% z portfolia
          </div>
        </div>
      </div>

      {/* Middle row: Quantity, Average, Current price */}
      <div className="grid grid-cols-2 py-2 px-3 my-1.5 rounded-xl bg-slate-950/40 border border-slate-800/40 text-xs">
        <div>
          <span className="text-[10px] text-slate-500 block">Pozice</span>
          <span className="font-mono text-slate-300">
            {valuation.quantity} ks @ <MoneyDisplay amount={valuation.holding.averageOpenPrice} currency={valuation.instrumentCurrency} className="text-xs" />
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500 block">Zisk / Ztráta</span>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <DeltaBadge valuePercent={valuation.unrealizedProfitPercent} />
          </div>
        </div>
      </div>

      {/* Bottom row: Inline tags */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <InlineTagEditor holdingId={holding.id} tags={holding.tags} />
        </div>
        <div className="text-right font-mono text-xs">
          <MoneyDisplay
            amount={valuation.unrealizedProfitTarget}
            showSign
            className={`font-semibold ${valuation.unrealizedProfitTarget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          />
        </div>
      </div>
    </div>
  );
};
