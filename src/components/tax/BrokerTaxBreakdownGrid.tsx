import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  BadgePercent,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import { BrokerTaxBreakdown } from '@/types/tax';
import { BrokerId } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface BrokerTaxBreakdownGridProps {
  brokers: BrokerTaxBreakdown[];
  isGlobalUnder100kLimit: boolean;
}

const getBrokerConfig = (brokerId: BrokerId) => {
  switch (brokerId) {
    case 'XTB':
      return {
        brandName: 'XTB (xStation)',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        borderColor: 'border-amber-500/30',
        glowColor: 'shadow-amber-500/5',
        dotColor: 'bg-amber-400',
      };
    case 'DEGIRO':
      return {
        brandName: 'DEGIRO',
        badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        borderColor: 'border-sky-500/30',
        glowColor: 'shadow-sky-500/5',
        dotColor: 'bg-sky-400',
      };
    case 'IBKR':
      return {
        brandName: 'Interactive Brokers',
        badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        borderColor: 'border-rose-500/30',
        glowColor: 'shadow-rose-500/5',
        dotColor: 'bg-rose-400',
      };
    case 'PORTU':
      return {
        brandName: 'Portu (WOOD & Co.)',
        badgeBg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        borderColor: 'border-teal-500/30',
        glowColor: 'shadow-teal-500/5',
        dotColor: 'bg-teal-400',
      };
    default:
      return {
        brandName: brokerId,
        badgeBg: 'bg-slate-700/30 text-slate-300 border-slate-700/50',
        borderColor: 'border-slate-800',
        glowColor: 'shadow-none',
        dotColor: 'bg-slate-400',
      };
  }
};

export const BrokerTaxBreakdownGrid: React.FC<BrokerTaxBreakdownGridProps> = ({
  brokers,
  isGlobalUnder100kLimit,
}) => {
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);

  if (!brokers || brokers.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-slate-400 text-xs">
        Pro vybraný rok nebyly nalezeny žádné transakce u registrovaných brokerů.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-bold text-slate-100">
            Rozpad daňového zatížení podle brokerů
          </h4>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {brokers.length} {brokers.length === 1 ? 'účet' : 'účty / brokeři'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brokers.map((broker) => {
          const cfg = getBrokerConfig(broker.brokerId);
          const isExpanded = expandedBroker === broker.accountId;
          const hasActivity =
            broker.sales.taxableTradesCount > 0 ||
            broker.sales.exemptTradesCount > 0 ||
            broker.dividends.foreignGrossCZK > 0 ||
            broker.dividends.domesticGrossCZK > 0;

          const sec10Tax = isGlobalUnder100kLimit
            ? 0
            : Math.max(0, Math.round(broker.sales.taxableNetResultCZK * 0.15));
          const sec8Tax = broker.dividends.czechTaxDueCZK;
          const totalTax = sec10Tax + sec8Tax;

          return (
            <div
              key={`${broker.brokerId}-${broker.accountId}`}
              className={`p-4 rounded-2xl bg-slate-900/70 border ${cfg.borderColor} shadow-lg ${cfg.glowColor} transition-all flex flex-col justify-between`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} shrink-0`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">
                        {cfg.brandName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                        {broker.baseCurrency}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {broker.accountName}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    Doplatek FÚ
                  </div>
                  <div className="text-base font-extrabold font-mono text-slate-100">
                    <MoneyDisplay amount={totalTax} currency="CZK" />
                  </div>
                </div>
              </div>

              {/* Quick Status Chips */}
              <div className="grid grid-cols-2 gap-2 my-3.5 pt-3 border-t border-slate-800/80">
                {/* § 10 Prodeje cenných papírů */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold">§ 10 Prodeje ({broker.sales.taxableTradesCount + broker.sales.exemptTradesCount})</span>
                    <TrendingUp className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">Výsledek:</span>
                    <span className={`text-xs font-mono font-bold ${
                      broker.sales.taxableNetResultCZK >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {broker.sales.taxableNetResultCZK > 0 ? '+' : ''}
                      {broker.sales.taxableNetResultCZK.toLocaleString('cs-CZ')} Kč
                    </span>
                  </div>
                </div>

                {/* § 8 Dividendy */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold">§ 8 Dividendy</span>
                    <BadgePercent className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">Hrubé:</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {(broker.dividends.foreignGrossCZK + broker.dividends.domesticGrossCZK).toLocaleString('cs-CZ')} Kč
                    </span>
                  </div>
                </div>
              </div>

              {/* Expand Toggle */}
              <button
                type="button"
                onClick={() => setExpandedBroker(isExpanded ? null : broker.accountId)}
                className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-[11px] text-slate-300 transition-colors"
              >
                <span>{isExpanded ? 'Skrýt podrobný rozpis' : 'Zobrazit daňové položky'}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Expanded Detailed Breakdown */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-2.5 text-xs">
                  {/* Sales Detail */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-1.5">
                    <div className="font-semibold text-slate-300 text-[11px] flex items-center justify-between">
                      <span>Prodeje cenných papírů (§ 10 ZDP)</span>
                      {isGlobalUnder100kLimit && (
                        <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          Osvobozeno do 100k
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Zdanitelné příjmy (tržby):</span>
                      <span className="font-mono text-slate-200">{broker.sales.taxableProceedsCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Výdaje (FIFO nabývací cena):</span>
                      <span className="font-mono text-slate-200">{(broker.sales.taxableAcquisitionCostCZK + broker.sales.taxableCommissionsCZK).toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Osvobozeno 3letým testem:</span>
                      <span className="font-mono text-emerald-400 font-semibold">+{broker.sales.exemptRealizedGainCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                  </div>

                  {/* Dividends Detail */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-1.5">
                    <div className="font-semibold text-slate-300 text-[11px]">
                      Dividendy a srážky (§ 8 & § 36 ZDP)
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Zahraniční hrubé:</span>
                      <span className="font-mono text-slate-200">{broker.dividends.foreignGrossCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Sraženo v zahraničí:</span>
                      <span className="font-mono text-slate-300">{broker.dividends.foreignWithholdingTaxPaidCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Uplatněný zápočet DTT:</span>
                      <span className="font-mono text-emerald-400">-{broker.dividends.foreignAllowableCreditCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Doplatek FÚ za dividendy:</span>
                      <span className="font-mono font-bold text-amber-400">{broker.dividends.czechTaxDueCZK.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    {broker.dividends.domesticGrossCZK > 0 && (
                      <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                        <span>Tuzemské dividendy (§ 36):</span>
                        <span className="font-mono text-slate-300">{broker.dividends.domesticGrossCZK.toLocaleString('cs-CZ')} Kč (15 % sraženo)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
