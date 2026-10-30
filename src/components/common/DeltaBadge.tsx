import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  valuePercent: number;
  valueAbs?: number;
  className?: string;
}

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
  valuePercent,
  className = '',
}) => {
  const isPositive = valuePercent > 0.001;
  const isNegative = valuePercent < -0.001;

  if (!isPositive && !isNegative) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-800 text-slate-400 ${className}`}>
        <Minus className="w-3 h-3" />
        <span>0.00%</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold transition-colors ${
        isPositive
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      } ${className}`}
    >
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>
        {isPositive ? '+' : ''}
        {valuePercent.toFixed(2)}%
      </span>
    </span>
  );
};
