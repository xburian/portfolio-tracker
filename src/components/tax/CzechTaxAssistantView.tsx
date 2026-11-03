import React, { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Download,
  Info,
  Scale,
  Sparkles,
  Building2,
  Receipt,
  ShoppingCart,
  Coins,
  TrendingDown,
  TrendingUp,
  Layers,
  Landmark,
  RotateCcw,
} from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { CzechTaxService } from '@/lib/services/czechTaxService';
import { ExchangeRateMethod, AnnualTaxReport } from '@/types/tax';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { TaxMetricDeck } from './TaxMetricDeck';
import { BrokerTaxBreakdownGrid } from './BrokerTaxBreakdownGrid';
import { TaxLossOptimizerPanel } from './TaxLossOptimizerPanel';

type TaxViewSubTab = 'overview' | 'optimizer' | 'transactions';

export const CzechTaxAssistantView: React.FC = () => {
  const closedPositions = usePortfolioStore((s) => s.closedPositions);
  const dividends = usePortfolioStore((s) => s.dividends);
  const accounts = usePortfolioStore((s) => s.accounts);
  const resetAndReloadSampleFiles = usePortfolioStore((s) => s.resetAndReloadSampleFiles);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [rateMethod, setRateMethod] = useState<ExchangeRateMethod>('GFR_UNIFORM');
  const [activeSubTab, setActiveSubTab] = useState<TaxViewSubTab>('overview');
  const [isReloading, setIsReloading] = useState<boolean>(false);

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
      rateMethod,
      accounts
    );
  }, [closedPositions, dividends, selectedYear, rateMethod, accounts]);

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

  const handleReloadData = async () => {
    setIsReloading(true);
    try {
      await resetAndReloadSampleFiles();
    } catch (e) {
      console.error('Failed to reload files:', e);
    } finally {
      setIsReloading(false);
    }
  };

  const nonExemptSales = report.securities.nonExemptGrossSalesCZK;
  const progress100k = Math.min(100, Math.round((nonExemptSales / 100_000) * 100));

  // Totals across all sales items in the selected tax year
  const totalSalesCZK = report.securities.totalGrossSalesAllCZK;
  const totalPurchaseCostCZK = report.salesItems.reduce((acc, i) => acc + i.purchaseCostCZK, 0);
  const totalFeesCZK = report.salesItems.reduce((acc, i) => acc + i.feeCZK, 0);
  const totalNetResultCZK = report.salesItems.reduce((acc, i) => acc + i.netProfitCZK, 0);
  const returnPercent = totalPurchaseCostCZK > 0
    ? Math.round((totalNetResultCZK / totalPurchaseCostCZK) * 1000) / 10
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls: Year & Exchange Rate Method */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Daňové přiznání FO — Rok {selectedYear}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                § 4, § 8, § 10 ZDP
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Přehled prodejů, nabývacích cen, zisku/ztráty a doplatku daně z výpisů brokerů
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {availableYears.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
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
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setRateMethod('GFR_UNIFORM')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                rateMethod === 'GFR_UNIFORM'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Jednotný kurz stanovený Finanční správou ČR pro celý rok (Pokyn GFŘ)"
            >
              Jednotný kurz GFŘ
            </button>
            <button
              type="button"
              onClick={() => setRateMethod('CNB_DAILY')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
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
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm ml-auto sm:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV audit</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards: Celkový prodej, Za kolik nakoupeno, Zisk/ztráta, Doplatek FÚ */}
      <TaxMetricDeck report={report} />

      {/* Empty Closed Positions Alert (with 1-click reload button) */}
      {report.salesItems.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong>V roce {selectedYear} nebyly v lokální databázi nalezeny žádné uzavřené prodeje.</strong>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Pokud jste již na brokerech (XTB, DEGIRO) v tomto roce prodávali, klikněte na tlačítko pro opětovné načtení a synchronizaci všech výpisů.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReloadData}
            disabled={isReloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
            <span>{isReloading ? 'Načítám...' : 'Znovu načíst výpisy z disku'}</span>
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-fit text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeSubTab === 'overview'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Přehled & Brokeři</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('optimizer')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeSubTab === 'optimizer'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Tax-Loss Harvesting (Zgrupováno dle tickeru)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('transactions')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeSubTab === 'transactions'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Položkový rozpis prodejů ({report.salesItems.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview & Brokers */}
      {activeSubTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Prominent Financial Balance Card: Celkový prodej, Nákup, Zisk/Ztráta */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Finanční bilance prodejů cenných papírů v roce {selectedYear} (§ 10 a § 4 ZDP)
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Metoda výdajů: FIFO • Účetní kurz: {rateMethod === 'GFR_UNIFORM' ? 'Jednotný GFŘ' : 'Denní ČNB'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/70">
                <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                  Celkové hrubé příjmy (Tržby):
                </span>
                <span className="text-lg font-bold text-slate-100 block">
                  {totalSalesCZK.toLocaleString('cs-CZ')} Kč
                </span>
                <span className="text-[11px] text-slate-500 font-sans mt-0.5 block">
                  {report.salesItems.length} realizovaných prodejů
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/70">
                <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                  Nákupní cena dle FIFO:
                </span>
                <span className="text-lg font-bold text-slate-100 block">
                  {totalPurchaseCostCZK.toLocaleString('cs-CZ')} Kč
                </span>
                <span className="text-[11px] text-slate-500 font-sans mt-0.5 block">
                  Poplatky: {totalFeesCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>

              <div className={`p-3.5 rounded-xl border ${
                totalNetResultCZK < 0
                  ? 'bg-rose-950/30 border-rose-500/40'
                  : totalNetResultCZK > 0
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : 'bg-slate-950/70 border-slate-800/70'
              }`}>
                <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                  Celkový zisk / ztráta:
                </span>
                <span className={`text-lg font-bold block ${
                  totalNetResultCZK < 0 ? 'text-rose-400' : totalNetResultCZK > 0 ? 'text-emerald-400' : 'text-slate-200'
                }`}>
                  {totalNetResultCZK > 0 ? '+' : ''}{totalNetResultCZK.toLocaleString('cs-CZ')} Kč
                </span>
                <span className={`text-[11px] font-sans font-semibold mt-0.5 block ${
                  totalNetResultCZK < 0 ? 'text-rose-300' : 'text-emerald-300'
                }`}>
                  {totalNetResultCZK < 0 ? 'Realizována čistá ztráta' : 'Realizován čistý zisk'} ({returnPercent} %)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/70">
                <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                  Dílčí základ daně (§ 10 ZDP):
                </span>
                <span className="text-lg font-bold text-amber-400 block">
                  {report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč
                </span>
                <span className="text-[11px] text-slate-500 font-sans mt-0.5 block">
                  {report.securities.taxBaseSecuritiesCZK === 0
                    ? totalNetResultCZK < 0
                      ? 'Ztráta – daň 0 Kč (nelze jít pod 0)'
                      : 'Osvobozeno – daň 0 Kč'
                    : `Daň 15 %: ${report.securities.estimatedTaxSecuritiesCZK.toLocaleString('cs-CZ')} Kč`}
                </span>
              </div>
            </div>
          </div>

          {/* 100 000 CZK Exemption Radar Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col gap-3">
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

          {/* Broker Breakdown Cards */}
          <BrokerTaxBreakdownGrid
            brokers={report.brokers}
            isGlobalUnder100kLimit={report.securities.isUnder100kLimit}
          />

          {/* § 38v ZDP Notification duty alert (if applicable) */}
          {report.securities.has5MNotificationDuty && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
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

          {/* Foreign Dividends (Schedule 3) Table */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-4">
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

            <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
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
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                          {c.countryName}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {c.countryCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-200 font-semibold">
                          {c.grossDividendsCZK.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-2.5 px-2 text-right text-rose-300">
                          {c.foreignTaxPaidCZK.toLocaleString('cs-CZ')} Kč ({c.effectiveForeignTaxRate} %)
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          {c.dttAllowedCreditRate} %
                        </td>
                        <td className="py-2.5 px-2 text-right text-emerald-400 font-semibold">
                          {c.allowedCreditCZK.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {c.czechTaxGrossCZK.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-2.5 px-3 text-right">
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

            {/* Domestic dividends note */}
            {report.dividends.domestic.count > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>
                    <strong>Tuzemské dividendy (§ 36 ZDP):</strong> {report.dividends.domestic.count} výplat v objemu {report.dividends.domestic.grossCZK.toLocaleString('cs-CZ')} Kč.
                  </span>
                </div>
                <div className="font-mono text-slate-400 text-[11px]">
                  Konečná 15% srážka ({report.dividends.domestic.finalWithholdingTaxPaidCZK.toLocaleString('cs-CZ')} Kč) sražena u zdroje v ČR (do DPFO nevstupuje).
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Tax-Loss Harvesting Optimizer (Grouped by Ticker) */}
      {activeSubTab === 'optimizer' && (
        <TaxLossOptimizerPanel report={report} />
      )}

      {/* Tab 3: Detailed Sales Transactions */}
      {activeSubTab === 'transactions' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-4">
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
                <span className="font-bold">{totalSalesCZK.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">VÝDAJE (FIFO + POPLATKY):</span>
                <span className="font-bold">{(totalPurchaseCostCZK + totalFeesCZK).toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">VÝSLEDEK (ZISK/ZTRÁTA):</span>
                <span className={`font-bold ${totalNetResultCZK >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalNetResultCZK > 0 ? '+' : ''}{totalNetResultCZK.toLocaleString('cs-CZ')} Kč
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">DÍLČÍ ZÁKLAD DANĚ:</span>
                <span className="font-bold text-amber-400">{report.securities.taxBaseSecuritiesCZK.toLocaleString('cs-CZ')} Kč</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
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
                  <th className="py-2.5 px-3 text-right">Čistý zisk/ztráta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {report.salesItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span>V roce {selectedYear} nebyly evidovány žádné uzavřené prodeje cenných papírů.</span>
                        <button
                          type="button"
                          onClick={handleReloadData}
                          disabled={isReloading}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                          <span>Znovu načíst výpisy z disku</span>
                        </button>
                      </div>
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
                        <td className="py-2 px-2 text-right text-slate-300">
                          {item.purchaseCostCZK.toLocaleString('cs-CZ')} Kč
                        </td>
                        <td className="py-2 px-2 text-right text-slate-400">
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
      )}
    </div>
  );
};
