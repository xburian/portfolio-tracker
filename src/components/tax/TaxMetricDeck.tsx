import React from 'react';
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import { AnnualTaxReport } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface TaxMetricDeckProps {
  report: AnnualTaxReport;
}

export const TaxMetricDeck: React.FC<TaxMetricDeckProps> = ({ report }) => {
  const totalTaxDue = report.totalEstimatedTaxDueCZK;
  const sec10TaxDue = report.securities.estimatedTaxSecuritiesCZK;
  const divTaxDue = report.dividends.netCzechTaxOnDividendsCZK;

  // 1. Celkový prodej (Hrubé tržby ze všech prodejů v daném roce)
  const totalSalesCZK = report.securities.totalGrossSalesAllCZK;

  // 2. Za kolik nakoupeno (Pořizovací náklady FIFO ze všech realizovaných prodejů v daném roce)
  const totalPurchaseCostCZK = report.salesItems.reduce((acc, i) => acc + i.purchaseCostCZK, 0);
  const totalFeesCZK = report.salesItems.reduce((acc, i) => acc + i.feeCZK, 0);

  // 3. Výsledný zisk nebo ztráta
  const totalNetResultCZK = report.salesItems.reduce((acc, i) => acc + i.netProfitCZK, 0);
  const isLoss = totalNetResultCZK < 0;
  const isProfitable = totalNetResultCZK > 0;
  const returnPercent = totalPurchaseCostCZK > 0
    ? Math.round((totalNetResultCZK / totalPurchaseCostCZK) * 1000) / 10
    : 0;

  const tradesCount = report.salesItems.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Celkový prodej v daném roce (Hrubé tržby) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-blue-400" />
            <span>Celkový prodej ({report.taxYear})</span>
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
            {tradesCount} {tradesCount === 1 ? 'obchod' : tradesCount < 5 ? 'obchody' : 'obchodů'}
          </span>
        </div>

        <div className="my-2.5">
          <MoneyDisplay
            amount={totalSalesCZK}
            currency="CZK"
            className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100 tracking-tight"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
          <span>Osvobozeno (3letý test):</span>
          <span className="font-mono text-emerald-400 font-semibold">
            {report.securities.exemptGrossSalesTimeTestCZK.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </div>

      {/* 2. Za kolik nakoupeno (Nabývací cena / Výdaje dle FIFO) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
            <span>Za kolik nakoupeno</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            FIFO nákupy
          </span>
        </div>

        <div className="my-2.5">
          <MoneyDisplay
            amount={totalPurchaseCostCZK}
            currency="CZK"
            className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100 tracking-tight"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
          <span>Poplatky brokerům:</span>
          <span className="font-mono text-slate-300 font-semibold">
            {totalFeesCZK.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </div>

      {/* 3. Výsledný zisk nebo ztráta */}
      <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-lg transition-all ${
        isLoss
          ? 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/20'
          : isProfitable
          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/20'
          : 'bg-slate-900/90 border-slate-800/90'
      }`}>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            {isLoss ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className={isLoss ? 'text-rose-300' : isProfitable ? 'text-emerald-300' : 'text-slate-300'}>
              {isLoss ? 'Realizovaná ztráta' : 'Realizovaný zisk'}
            </span>
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
            isLoss
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : isProfitable
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {isProfitable ? '+' : ''}{returnPercent} %
          </span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
              isLoss ? 'text-rose-400' : isProfitable ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {totalNetResultCZK > 0 ? '+' : ''}
              {totalNetResultCZK.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] border-t border-slate-800/80 pt-2 mt-1">
          <span className="text-slate-400">Dílčí základ daně (§ 10):</span>
          <span className="font-mono font-bold text-slate-200">
            {report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč
            {isLoss && (
              <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">(podlaha 0 Kč)</span>
            )}
          </span>
        </div>
      </div>

      {/* 4. Celková daň k úhradě FÚ */}
      <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-lg ${
        totalTaxDue > 0
          ? 'bg-amber-950/20 border-amber-500/40 shadow-amber-950/20'
          : 'bg-emerald-950/15 border-emerald-500/40 shadow-emerald-950/20'
      }`}>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            <span>Doplatek FÚ celkem</span>
          </span>
          <div className={`p-1 rounded-md ${
            totalTaxDue > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
          }`}>
            {totalTaxDue > 0 ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
          </div>
        </div>

        <div className="my-2.5">
          <MoneyDisplay
            amount={totalTaxDue}
            currency="CZK"
            className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
              totalTaxDue > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] border-t border-slate-800/80 pt-2 mt-1">
          <span className="text-slate-400">Rozpad doplatku:</span>
          <span className="font-mono text-slate-300">
            § 10: <span className={sec10TaxDue > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{sec10TaxDue} Kč</span> | § 8: <span className={divTaxDue > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{divTaxDue} Kč</span>
          </span>
        </div>
      </div>
    </div>
  );
};
