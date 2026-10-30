import React, { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { Navbar } from '@/components/layout/Navbar';
import { NavigationTabs } from '@/components/layout/NavigationTabs';
import { MetricDeck } from '@/components/dashboard/MetricDeck';
import { PerformanceMetricsCard } from '@/components/dashboard/PerformanceMetricsCard';
import { DonutAllocation } from '@/components/dashboard/DonutAllocation';
import { QuickFilterBar } from '@/components/dashboard/QuickFilterBar';
import { HoldingsTable } from '@/components/holdings/HoldingsTable';
import { AllocationBreakdown } from '@/components/breakdown/AllocationBreakdown';
import { ClusterManagerDrawer } from '@/components/clusters/ClusterManagerDrawer';
import { ProjectionSimulator } from '@/components/projection/ProjectionSimulator';
import { ImportModal } from '@/components/import/ImportModal';
import { CashManagerModal } from '@/components/cash/CashManagerModal';
import { Upload, Sparkles, PieChart, ShieldCheck, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  const initFromDb = usePortfolioStore((s) => s.initFromDb);
  const isLoading = usePortfolioStore((s) => s.isLoading);
  const holdings = usePortfolioStore((s) => s.holdings);
  const lots = usePortfolioStore((s) => s.lots);
  const accounts = usePortfolioStore((s) => s.accounts);
  const clusters = usePortfolioStore((s) => s.clusters);
  const selectedAccountFilter = usePortfolioStore((s) => s.selectedAccountFilter);
  const selectedClusterFilter = usePortfolioStore((s) => s.selectedClusterFilter);
  const searchQuery = usePortfolioStore((s) => s.searchQuery);
  const getValuations = usePortfolioStore((s) => s.getValuations);
  const getSummary = usePortfolioStore((s) => s.getSummary);
  const loadSampleFiles = usePortfolioStore((s) => s.loadSampleFiles);
  const resetAndReloadSampleFiles = usePortfolioStore((s) => s.resetAndReloadSampleFiles);

  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const updateRates = useCurrencyStore((s) => s.updateRates);
  const activeTab = usePreferencesStore((s) => s.activeTab);
  const initAuth = useAuthStore((s) => s.initAuth);

  const [importOpen, setImportOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    initFromDb();
    updateRates();
    initAuth();
  }, [initFromDb, updateRates, initAuth]);

  const valuations = getValuations(displayCurrency);
  const summary = getSummary(displayCurrency);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col antialiased">
      <Navbar onOpenImport={() => setImportOpen(true)} onOpenCash={() => setCashModalOpen(true)} />
      <NavigationTabs />

      <main className="flex-1 max-w-[1720px] 2xl:max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : holdings.length === 0 ? (
          /* Empty State */
          <div className="max-w-2xl mx-auto my-12 glass-panel p-8 sm:p-12 rounded-3xl text-center border border-slate-800/80 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-5 shadow-lg shadow-indigo-500/10">
              <Upload className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Vítejte v Portfolio Trackeru
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Nahrajte výpis z brokera (XTB .xlsx, Degiro, Interactive Brokers nebo Portu). Aplikace data přechroupe, seskupí a vizualizuje.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-8 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <Sparkles className="w-4 h-4 text-indigo-400 mb-2" />
                <h4 className="text-xs font-semibold text-slate-200">Smart S&P 500</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Automatické shlukování stejných ETF napříč měnami</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <PieChart className="w-4 h-4 text-cyan-400 mb-2" />
                <h4 className="text-xs font-semibold text-slate-200">Rozpad aktiv</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Absolutně v Kč i v procentech s koláčovým grafem</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-2" />
                <h4 className="text-xs font-semibold text-slate-200">Časový test & FIRE</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">3letý test (§ 4 ZDP), osvobození od daně a FIRE cíl</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setImportOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Nahrát výpis brokera</span>
              </button>

              <button
                onClick={async () => {
                  setIsDemoLoading(true);
                  try {
                    await resetAndReloadSampleFiles();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsDemoLoading(false);
                  }
                }}
                disabled={isDemoLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              >
                <RotateCcw className={`w-4 h-4 text-indigo-400 ${isDemoLoading ? 'animate-spin' : ''}`} />
                <span>{isDemoLoading ? 'Čistím & importuji data...' : 'Smazat & načíst čisté výpisy (Portu 2x, Degiro, IBKR, XTB)'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Tabs */
          <div className="flex flex-col gap-6">
            {activeTab === 'dashboard' && (
              <>
                <MetricDeck summary={summary} onOpenCashManager={() => setCashModalOpen(true)} />
                <PerformanceMetricsCard valuations={valuations} />
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4">
                    <QuickFilterBar onOpenCashManager={() => setCashModalOpen(true)} />
                    <HoldingsTable valuations={valuations} />
                  </div>
                  <div className="lg:col-span-1 xl:col-span-1">
                    <DonutAllocation valuations={valuations} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'holdings' && (
              <div className="flex flex-col gap-4">
                <QuickFilterBar onOpenCashManager={() => setCashModalOpen(true)} />
                <HoldingsTable valuations={valuations} />
              </div>
            )}

            {activeTab === 'breakdown' && (
              <AllocationBreakdown valuations={valuations} />
            )}

            {activeTab === 'clusters' && (
              <ClusterManagerDrawer />
            )}

            {activeTab === 'projection' && (
              <ProjectionSimulator valuations={valuations} />
            )}
          </div>
        )}
      </main>

      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
      <CashManagerModal open={cashModalOpen} onOpenChange={setCashModalOpen} />
    </div>
  );
};
