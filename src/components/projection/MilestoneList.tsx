import React from 'react';
import { Award, Calendar, CheckCircle2 } from 'lucide-react';
import { MilestoneResult } from '@/lib/services/fireService';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface MilestoneListProps {
  milestones: MilestoneResult[];
  currentValue: number;
}

export const MilestoneList: React.FC<MilestoneListProps> = ({ milestones, currentValue }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {milestones.map((m) => {
        const isReached = currentValue >= m.targetAmount;
        return (
          <div
            key={m.targetAmount}
            className={`p-3.5 rounded-2xl border transition-all ${
              isReached
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'glass-panel border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">Milník</span>
              {isReached ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Award className="w-4 h-4 text-indigo-400" />
              )}
            </div>

            <div className="mt-2">
              <MoneyDisplay
                amount={m.targetAmount}
                className="text-base font-bold text-slate-100 tracking-tight"
              />
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">
                {isReached ? 'Dosaženo!' : `${m.years} let`}
              </span>
              <span className={`font-semibold ${isReached ? 'text-emerald-400' : 'text-indigo-400'}`}>
                {isReached ? 'Hotovo' : m.targetDate}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
