import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Upload,
  RefreshCw,
  PieChart,
  ShieldAlert,
  RotateCcw,
  Coins,
  Lock,
  Database,
  UserCheck,
} from 'lucide-react';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { ProfileSwitcher } from '@/components/layout/ProfileSwitcher';
import { AuthModal } from '@/components/auth/AuthModal';

interface NavbarProps {
  onOpenImport: () => void;
  onOpenCash?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenImport, onOpenCash }) => {
  const privacyMode = usePreferencesStore((s) => s.privacyMode);
  const togglePrivacyMode = usePreferencesStore((s) => s.togglePrivacyMode);

  const isRefreshingPrices = usePortfolioStore((s) => s.isRefreshingPrices);
  const refreshLivePrices = usePortfolioStore((s) => s.refreshLivePrices);
  const lastPriceRefreshAt = usePortfolioStore((s) => s.lastPriceRefreshAt);
  const holdingsCount = usePortfolioStore((s) => s.holdings.length);
  const clearAllData = usePortfolioStore((s) => s.clearAllData);
  const resetAndReloadSampleFiles = usePortfolioStore((s) => s.resetAndReloadSampleFiles);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageStatus = useAuthStore((s) => s.storageStatus);

  const [isResetting, setIsResetting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Global hotkey 'p' for privacy mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        togglePrivacyMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePrivacyMode]);

  const isRedis = storageStatus?.type === 'redis';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0E14]/80 backdrop-blur-xl">
      <div className="max-w-[1720px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <PieChart className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-100 tracking-tight">Portfolio Tracker</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block font-mono">
              {holdingsCount > 0 ? `${holdingsCount} otevřených pozic` : 'Připraveno k importu'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Auth & Storage Indicator Button */}
          <button
            onClick={() => setAuthModalOpen(true)}
            title={
              isAuthenticated && user
                ? `Přihlášen jako ${user.name} (${user.role}) • Úložiště: ${isRedis ? 'Produkční Redis' : 'Lokální In-Memory'}`
                : 'Přihlášení / Registrace (JWT + Redis/In-Memory)'
            }
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-xs"
          >
            {isAuthenticated && user ? (
              <>
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-sm">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-200 hidden md:inline max-w-[110px] truncate">
                  {user.name}
                </span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-slate-300 hidden md:inline">Přihlásit</span>
              </>
            )}

            {/* Storage Pill Indicator */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold border ${
                isRedis
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              <Database className="w-2.5 h-2.5" />
              <span>{isRedis ? 'REDIS' : 'MEM'}</span>
            </div>
          </button>

          {/* User Profile Switcher */}
          <ProfileSwitcher />

          {/* Refresh Quotes */}
          {holdingsCount > 0 && (
            <button
              onClick={() => refreshLivePrices()}
              disabled={isRefreshingPrices}
              title={`Aktualizovat tržní ceny (naposledy: ${lastPriceRefreshAt || 'nikdy'})`}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingPrices ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          )}

          {/* Privacy Mode Toggle */}
          <button
            onClick={togglePrivacyMode}
            title={`Privacy Mode [Klávesa P] (${privacyMode ? 'Zapnuto' : 'Vypnuto'})`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              privacyMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {privacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Privacy</span>
          </button>

          {/* Currency Switcher */}
          <CurrencySelect />

          {/* Cash Manager Button */}
          {onOpenCash && (
            <button
              onClick={onOpenCash}
              title="Správa volné hotovosti (Kč, USD, EUR)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Coins className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hotovost</span>
            </button>
          )}

          {/* Smazat & čistě načíst výpisy */}
          <button
            onClick={async () => {
              if (
                window.confirm(
                  'Smazat všechna stará data a čistě znovu načíst všech 7 výpisů (Portu 2x, Degiro, IBKR, XTB 3x)?\n\nTím se vymaže mezipaměť a nahrají se přesná data s celkovou hodnotou ~9 mil. Kč bez duplicit.'
                )
              ) {
                setIsResetting(true);
                try {
                  await resetAndReloadSampleFiles();
                } catch (e: any) {
                  alert('Chyba při resetu a načtení výpisů: ' + (e.message || String(e)));
                } finally {
                  setIsResetting(false);
                }
              }
            }}
            disabled={isResetting}
            title="Smazat mezipaměť a čistě načíst výpisy (Portu 2x, Degiro, IBKR, XTB)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">{isResetting ? 'Čistím & načítám...' : 'Smazat & načíst výpisy'}</span>
          </button>

          {/* Import Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nahrát výpis</span>
          </button>

          {/* Clear data button (if holdings exist) */}
          {holdingsCount > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Opravdu chcete smazat importovaná data aktuálního profilu?')) {
                  clearAllData();
                }
              }}
              title="Vymazat data tohoto profilu"
              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl border border-slate-800 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </header>
  );
};
