import React, { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Download,
  Info,
  CheckCircle,
  Clock,
  Coins,
  Receipt,
  Scale,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { CzechTaxService } from '@/lib/services/czechTaxService';
import { ExchangeRateMethod, AnnualTaxReport } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

export const CzechTaxAssistantView: React.FC = () => {
  const closedPositions = usePortfolioStore((s) => s.closedPositions);
  const dividends = usePortfolioStore((s) => s.dividends);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [rateMethod, setRateMethod] = useState<ExchangeRateMethod>('GFR_UNIFORM');

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    yearsSet.add(currentYear - 1);
    yearsSet.add(currentYear - 2);

    for (const p of closedPositions) {
      const d = new Date(p.closeDateUtc);
      if (!isNaN(d.getTime())) yearsSet.add(d.getUTCFullYear());
    }
    for (const d of dividends) {
      const dt = new Date(d.paymentDateUtc);
      if (!isNaN(dt.getTime())) yearsSet.add(dt.getUTCFullYear());
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [closedPositions, dividends, currentYear]);

  const report: AnnualTaxReport = useMemo(() => {
    return CzechTaxService.generateAnnualTaxReport(
      closedPositions,
      dividends,
      selectedYear,
      rateMethod
    );
  }, [closedPositions, dividends, selectedYear, rateMethod]);

  const handleDownloadCsv = () => {
    const csvContent = CzechTaxService.exportTaxReportToCsv(report);
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danove-podklady-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nonExemptSales = report.securities.nonExemptGrossSalesCZK;
  const progress100k = Math.min(100, Math.round((nonExemptSales / 100_000) * 100));

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls: Year & Exchange Rate Method */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100">
              Daňové přiznání FO — Rok {selectedYear}
            </h4>
            <p className="text-xs text-slate-400">
              Podklady pro Přílohu č. 2 (§ 10 ZDP) a Přílohu č. 3 (§ 8 ZDP)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  selectedYear === y
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Rate Method Toggle */}
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setRateMethod('GFR_UNIFORM')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                rateMethod === 'GFR_UNIFORM'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Jednotný kurz stanovený Finanční správou ČR pro celý rok (Pokyn GFŘ)"
            >
              Jednotný kurz GFŘ
            </button>
            <button
              onClick={() => setRateMethod('CNB_DAILY')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                rateMethod === 'CNB_DAILY'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Denní kurz ČNB ke dni uskutečnění transakce"
            >
              Denní kurz ČNB
            </button>
          </div>

          {/* Download CSV button */}
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm ml-auto sm:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Stáhnout podklady (CSV)</span>
          </button>
        </div>
      </div>

      {/* 100 000 CZK Exemption Radar Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${report.securities.isUnder100kLimit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {report.securities.isUnder100kLimit ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200">
                Hlídač ročního limitu 100 000 Kč (§ 4 odst. 1 písm. v) ZDP)
              </span>
              <p className="text-[11px] text-slate-400">
                Osvobozeny jsou veškeré příjmy z prodeje cenných papírů, pokud jejich úhrn za rok nepřekročí 100 000 Kč.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report.securities.isUnder100kLimit ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ✓ 100% OSVOBOZENO (0 Kč daň)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                ⚠️ LIMIT PŘEKROČEN (Zdaňuje se)
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 ${report.securities.isUnder100kLimit ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${progress100k}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>
            Neosvobozené prodeje: <strong className="text-slate-200">{nonExemptSales.toLocaleString('cs-CZ')} Kč</strong> z 100 000 Kč
          </span>
          <span>
            {report.securities.isUnder100kLimit ? (
              <span className="text-emerald-400">Zbývá vyčerpat: {report.securities.remaining100kCapacityCZK.toLocaleString('cs-CZ')} Kč</span>
            ) : (
              <span className="text-amber-400">Překročeno o {(nonExemptSales - 100_000).toLocaleString('cs-CZ')} Kč</span>
            )}
          </span>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Základ daně § 10 */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Základ daně § 10</span>
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">
              <MoneyDisplay amount={report.securities.taxBaseSecuritiesCZK} currency="CZK" />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Příjmy - Výdaje (FIFO)
            </p>
          </div>
        </div>

        {/* 2. Daň z prodeje CP (15 %) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Daň z prodejů CP (15 %)</span>
            <Coins className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold font-mono ${report.securities.estimatedTaxSecuritiesCZK > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              <MoneyDisplay amount={report.securities.estimatedTaxSecuritiesCZK} currency="CZK" />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Příloha č. 2 řádek 209
            </p>
          </div>
        </div>

        {/* 3. Doplatek daně z dividend (§ 8) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Doplatek z dividend (§ 8)</span>
            <Receipt className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold font-mono ${report.dividends.netCzechTaxOnDividendsCZK > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              <MoneyDisplay amount={report.dividends.netCzechTaxOnDividendsCZK} currency="CZK" />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Po zápočtu 15% DTT daně
            </p>
          </div>
        </div>

        {/* 4. Celková daň k úhradě */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Celková daň k úhradě</span>
            <Scale className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold font-mono ${report.totalEstimatedTaxDueCZK > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              <MoneyDisplay amount={report.totalEstimatedTaxDueCZK} currency="CZK" />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              CP + Zahraniční dividendy
            </p>
          </div>
        </div>

        {/* 5. Ušetřeno na dani (3letý test + 100k) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ušetřeno na dani</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-emerald-400">
              +<MoneyDisplay amount={report.totalTaxSavingsCZK} currency="CZK" />
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              3letý test (§ 4) + 100k limit
            </p>
          </div>
        </div>
      </div>

      {/* § 38v ZDP Notification duty alert (if applicable) */}
      {report.securities.has5MNotificationDuty && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-300 block text-sm">
              Pozor: Vzniká oznamovací povinnost osvobozeného příjmu nad 5 000 000 Kč (§ 38v ZDP)
            </strong>
            <p className="mt-1 leading-relaxed text-amber-200/90">
              V roce {selectedYear} jste realizovali osvobozený prodej cenných papírů s hrubým příjmem přesahujícím 5 mil. Kč. Tyto příjmy sice nepodléhají dani z příjmů, ale je nutné podat samostatné <em>„Oznámení o osvobozených příjmech“</em> ve stejné lhůtě jako daňové přiznání. Neoznámení je sankcionováno pokutou až 15 % z neoznámené částky.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Příloha č. 2 (§ 10 ZDP — Cenné papíry) */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Příloha č. 2 — Ostatní příjmy z prodeje cenných papírů (§ 10 ZDP)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Rozpad nákupních výdajů (FIFO), prodejních cen a poplatků v roce {selectedYear}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px]">HRUBÉ PŘÍJMY:</span>
              <span className="font-bold">{report.securities.taxableGrossRevenueCZK.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">VÝDAJE (FIFO + POPLATKY):</span>
              <span className="font-bold">{(report.securities.deductiblePurchaseCostsCZK + report.securities.deductibleFeesCZK).toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">DÍLČÍ ZÁKLAD DANĚ:</span>
              <span className="font-bold text-amber-400">{report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>
        </div>

        {/* Table of sales */}
        <div className="relative overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Instrument</th>
                <th className="py-2.5 px-2 text-center">Broker</th>
                <th className="py-2.5 px-2 text-right">Držení</th>
                <th className="py-2.5 px-3 text-center">Status § 4</th>
                <th className="py-2.5 px-2 text-right">Prodej (Příjem)</th>
                <th className="py-2.5 px-2 text-right">Nákup (Výdaj)</th>
                <th className="py-2.5 px-2 text-right">Poplatek</th>
                <th className="py-2.5 px-3 text-right">Čistý zisk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {report.salesItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                    V roce {selectedYear} nebyly evidovány žádné uzavřené prodeje cenných papírů.
                  </td>
                </tr>
              ) : (
                report.salesItems.map((item) => {
                  const isPositive = item.netProfitCZK >= 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-200">{item.ticker}</span>
                        <span className="text-[10px] text-slate-500 font-sans block truncate max-w-[120px]">{item.name}</span>
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {item.brokerId}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-slate-300">{item.holdingPeriodDays}</span>
                        <span className="text-[10px] text-slate-500 font-sans ml-1">dní</span>
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        {item.isTimeTestExempt ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            🛡️ Osvobozeno
                          </span>
                        ) : report.securities.isUnder100kLimit ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            ✓ Limit 100k
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Zdanitelné
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-200 font-semibold">
                        {item.grossSaleCZK.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {item.purchaseCostCZK.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500">
                        {item.feeCZK.toLocaleString('cs-CZ')} Kč
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{item.netProfitCZK.toLocaleString('cs-CZ')} Kč
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Příloha č. 3 (§ 8 ZDP — Zahraniční dividendy) */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <span>Příloha č. 3 — Zahraniční dividendy & Zápočet daně (§ 8 ZDP & SZDZ)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Metoda prostého zápočtu daně zaplacené v zahraničí podle mezinárodních smluv
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px]">HRUBÉ DIVIDENDY:</span>
              <span className="font-bold">{report.dividends.totalGrossForeignDividendsCZK.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">UPLATNĚNÝ ZÁPOČET:</span>
              <span className="font-bold text-emerald-400">{report.dividends.totalAllowedCreditCZK.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">DOPLATEK V ČR:</span>
              <span className={`font-bold ${report.dividends.netCzechTaxOnDividendsCZK > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {report.dividends.netCzechTaxOnDividendsCZK.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          </div>
        </div>

        {/* Table of foreign dividends per country */}
        <div className="relative overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Stát zdroje</th>
                <th className="py-2.5 px-2 text-center">Kód</th>
                <th className="py-2.5 px-2 text-right">Hrubá dividenda</th>
                <th className="py-2.5 px-2 text-right">Sražená daň (Zahraničí)</th>
                <th className="py-2.5 px-2 text-center">Sazba DTT</th>
                <th className="py-2.5 px-2 text-right">Uplatnitelný zápočet</th>
                <th className="py-2.5 px-2 text-right">Daň v ČR (15 %)</th>
                <th className="py-2.5 px-3 text-right">Doplatek v ČR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {report.dividends.countryBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                    V roce {selectedYear} nebyly evidovány žádné zahraniční dividendy.
                  </td>
                </tr>
              ) : (
                report.dividends.countryBreakdown.map((c) => (
                  <tr key={c.countryCode} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-sans font-medium text-slate-200">
                      {c.countryName}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {c.countryCode}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-200 font-semibold">
                      {c.grossDividendsCZK.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="py-2 px-2 text-right text-rose-300">
                      {c.foreignTaxPaidCZK.toLocaleString('cs-CZ')} Kč ({c.effectiveForeignTaxRate} %)
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">
                      {c.dttAllowedCreditRate} %
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-400 font-semibold">
                      {c.allowedCreditCZK.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="py-2 px-2 text-right text-slate-300">
                      {c.czechTaxGrossCZK.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-bold ${c.czechTaxDueCZK > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {c.czechTaxDueCZK.toLocaleString('cs-CZ')} Kč
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legal & Educational Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-900/30 p-3.5 rounded-lg border border-slate-800/60">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          Tento přehled slouží jako pomocný analytický podklad pro vyplnění formuláře přiznání k dani z příjmů fyzických osob (DAP FO) v souladu se zákonem č. 586/1992 Sb. a Pokyny GFŘ. Tuzemské dividendy sražené plátcem (např. ČEZ, Moneta) jsou zdaněny konečnou srážkovou daní 15 % a do přiznání se neuvádějí. V případě nejasností konzultujte daňového poradce.
        </span>
      </div>
    </div>
  );
};
