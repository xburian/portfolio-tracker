import React from 'react';
import {
  Scale,
  TrendingDown,
  BadgePercent,
  Landmark,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calendar,
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
  const totalPaidAtSource =
    report.dividends.totalForeignTaxPaidCZK +
    report.dividends.domestic.finalWithholdingTaxPaidCZK;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Celková daň k úhradě FÚ */}
      <div className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
        totalTaxDue > 0
          ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
      }`}>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Doplatek Finančnímu úřadu
          </span>
          <div className={`p-1.5 rounded-lg ${
            totalTaxDue > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
          }`}>
            <Scale className="w-4 h-4" />
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

        <div className="flex items-center gap-1.5 text-xs">
          {totalTaxDue > 0 ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-medium text-[11px]">
                Čeká na doplatek v DPFO za rok {report.taxYear}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium text-[11px]">
                Žádný doplatek daně nevzniká (0 Kč)
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. § 10 ZDP - Prodeje cenných papírů */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            § 10 Prodeje cenných papírů
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-2">
            <MoneyDisplay
              amount={sec10TaxDue}
              currency="CZK"
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                sec10TaxDue > 0 ? 'text-slate-100' : 'text-emerald-400'
              }`}
            />
            {sec10TaxDue > 0 && (
              <span className="text-xs text-slate-400 font-mono">
                (15 % z {report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
          <span>Limit 100 000 Kč (§ 4):</span>
          <span className={`font-semibold px-2 py-0.5 rounded ${
            report.securities.isUnder100kLimit
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-slate-800 text-slate-300'
          }`}>
            {report.securities.isUnder100kLimit ? 'Plně osvobozeno' : 'Překročen (> 100k)'}
          </span>
        </div>
      </div>

      {/* 3. § 8 ZDP - Zahraniční dividendy */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            § 8 Zahraniční dividendy
          </span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <BadgePercent className="w-4 h-4" />
          </div>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-2">
            <MoneyDisplay
              amount={divTaxDue}
              currency="CZK"
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                divTaxDue > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            />
            <span className="text-xs text-slate-400 font-mono">
              doplatek FÚ
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
          <span>Uznaný zápočet DTT:</span>
          <span className="font-mono text-emerald-400 font-semibold">
            {report.dividends.totalAllowedCreditCZK.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </div>

      {/* 4. Již sraženo u zdroje (Celosvětově + Tuzemsko) */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Již sraženo u zdroje
          </span>
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
            <Landmark className="w-4 h-4" />
          </div>
        </div>

        <div className="my-2.5">
          <MoneyDisplay
            amount={totalPaidAtSource}
            currency="CZK"
            className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-200 tracking-tight"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
          <span>ČR srážka (§ 36):</span>
          <span className="font-mono text-slate-300">
            {report.dividends.domestic.finalWithholdingTaxPaidCZK.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </div>
    </div>
  );
};
