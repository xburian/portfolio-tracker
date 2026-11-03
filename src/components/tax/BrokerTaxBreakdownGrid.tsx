import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Receipt,
  BadgePercent,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Scale,
  ShoppingCart,
} from 'lucide-react';
import { BrokerId } from '@/types/portfolio';
import { BrokerTaxBreakdown } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface BrokerTaxBreakdownGridProps {
  brokers: BrokerTaxBreakdown[];
  isGlobalUnder100kLimit: boolean;
}

interface BrokerConfig {
  brandName: string;
  badgeBg: string;
  borderColor: string;
  glowColor: string;
  dotColor: string;
}

const getBrokerConfig = (brokerId: BrokerId): BrokerConfig => {
  switch (brokerId) {
    case 'XTB':
      return {
        brandName: 'XTB (xStation)',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        glowColor: 'shadow-emerald-500/5',
        dotColor: 'bg-emerald-400',
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
            Rozpad prodejů a daní podle brokerů
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
          
          const totalBrokerSales = broker.sales.taxableProceedsCZK + broker.sales.exemptProceedsCZK;
          const totalBrokerCost = broker.sales.taxableAcquisitionCostCZK + broker.sales.exemptAcquisitionCostCZK + broker.sales.taxableCommissionsCZK;
          const totalBrokerGain = broker.sales.taxableNetResultCZK + broker.sales.exemptRealizedGainCZK;
          const totalTrades = broker.sales.taxableTradesCount + broker.sales.exemptTradesCount;

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
                  <div className={`text-base font-extrabold font-mono ${totalTax > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    <MoneyDisplay amount={totalTax} currency="CZK" />
                  </div>
                </div>
              </div>

              {/* Financial Sales Summary: Prodej, Nákup, Zisk/Ztráta */}
              <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Prodej:</span>
                  <span className="font-bold text-slate-200">
                    {totalBrokerSales.toLocaleString('cs-CZ')} Kč
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {totalTrades} {totalTrades === 1 ? 'obchod' : 'obchodů'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Nákup (FIFO):</span>
                  <span className="font-bold text-slate-200">
                    {totalBrokerCost.toLocaleString('cs-CZ')} Kč
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    vč. poplatků
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Zisk / Ztráta:</span>
                  <span className={`font-bold ${totalBrokerGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalBrokerGain > 0 ? '+' : ''}{totalBrokerGain.toLocaleString('cs-CZ')} Kč
                  </span>
                  <span className="text-[10px] text-slate-500 block font-sans">
                    {totalBrokerGain < 0 ? 'Ztráta' : 'Zisk'}
                  </span>
                </div>
              </div>

              {/* Dividendy banner */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
                <span>Hrubé dividendy (zahraniční + CZ):</span>
                <span className="font-mono text-slate-300 font-semibold">
                  {(broker.dividends.foreignGrossCZK + broker.dividends.domesticGrossCZK).toLocaleString('cs-CZ')} Kč
                  {broker.dividends.czechTaxDueCZK > 0 && (
                    <span className="text-amber-400 ml-1">(doplatek {broker.dividends.czechTaxDueCZK} Kč)</span>
                  )}
                </span>
              </div>

              {/* Expand Toggle */}
              <button
                type="button"
                onClick={() => setExpandedBroker(isExpanded ? null : broker.accountId)}
                className="flex items-center justify-between w-full py-1.5 px-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-[11px] text-slate-300 transition-colors"
              >
                <span>{isExpanded ? 'Skrýt podrobný rozpis' : 'Zobrazit daňové položky (§ 10, § 8, § 36)'}</span>
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

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
                      <div>Neosvobozené tržby:</div>
                      <div className="text-right text-slate-200">
                        {broker.sales.taxableProceedsCZK.toLocaleString('cs-CZ')} Kč
                      </div>

                      <div>Nabývací výdaje + poplatky:</div>
                      <div className="text-right text-slate-200">
                        {(broker.sales.taxableAcquisitionCostCZK + broker.sales.taxableCommissionsCZK).toLocaleString('cs-CZ')} Kč
                      </div>

                      <div>Neosvobozený zisk/ztráta:</div>
                      <div className={`text-right font-bold ${
                        broker.sales.taxableNetResultCZK >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {broker.sales.taxableNetResultCZK > 0 ? '+' : ''}
                        {broker.sales.taxableNetResultCZK.toLocaleString('cs-CZ')} Kč
                      </div>

                      {broker.sales.exemptProceedsCZK > 0 && (
                        <>
                          <div className="text-emerald-400/90">Osvobozeno (3letý test):</div>
                          <div className="text-right text-emerald-400 font-bold">
                            {broker.sales.exemptProceedsCZK.toLocaleString('cs-CZ')} Kč
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dividends Detail */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-1.5">
                    <div className="font-semibold text-slate-300 text-[11px]">
                      Dividendy (§ 8 a § 36 ZDP)
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
                      <div>Zahraniční hrubé:</div>
                      <div className="text-right text-slate-200">
                        {broker.dividends.foreignGrossCZK.toLocaleString('cs-CZ')} Kč
                      </div>

                      <div>Sraženo v zahraničí:</div>
                      <div className="text-right text-slate-300">
                        {broker.dividends.foreignWithholdingTaxPaidCZK.toLocaleString('cs-CZ')} Kč
                      </div>

                      <div>Uplatnitelný zápočet SZDZ:</div>
                      <div className="text-right text-emerald-400">
                        {broker.dividends.foreignAllowableCreditCZK.toLocaleString('cs-CZ')} Kč
                      </div>

                      <div>Doplatek v ČR (§ 8):</div>
                      <div className={`text-right font-bold ${
                        broker.dividends.czechTaxDueCZK > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {broker.dividends.czechTaxDueCZK} Kč
                      </div>

                      {broker.dividends.domesticGrossCZK > 0 && (
                        <>
                          <div className="text-slate-400">Tuzemské dividendy (§ 36):</div>
                          <div className="text-right text-slate-200">
                            {broker.dividends.domesticGrossCZK.toLocaleString('cs-CZ')} Kč
                          </div>
                          <div className="text-slate-500">Sraženo v ČR (15 %):</div>
                          <div className="text-right text-slate-400">
                            {broker.dividends.domesticWithholdingTaxCZK.toLocaleString('cs-CZ')} Kč
                          </div>
                        </>
                      )}
                    </div>
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
