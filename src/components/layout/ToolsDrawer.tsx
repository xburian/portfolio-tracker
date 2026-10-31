import React from 'react';
import {
  X,
  SlidersHorizontal,
  Lock,
  UserCheck,
  Database,
  Coins,
  RefreshCw,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldAlert,
  Globe,
  Layers,
  Sparkles,
} from 'lucide-react';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { ProfileSwitcher } from '@/components/layout/ProfileSwitcher';

interface ToolsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onOpenCash?: () => void;
}

export const ToolsDrawer: React.FC<ToolsDrawerProps> = ({
  open,
  onClose,
  onOpenAuth,
  onOpenCash,
}) => {
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

  const [isResetting, setIsResetting] = React.useState(false);

  if (!open) return null;

  const isRedis = storageStatus?.type === 'redis';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm sm:max-w-md bg-[#0D1117] border-l border-slate-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Ovládací centrum & Nástroje</h3>
                <p className="text-[11px] text-slate-400 font-mono">Nastavení profilu, měny, trhů a dat</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
            {/* 1. Uživatel & Úložiště */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Účet & Úložiště</span>
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold border ${
                    isRedis
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  }`}
                >
                  <Database className="w-2.5 h-2.5" />
                  <span>{isRedis ? 'PRODUKČNÍ REDIS' : 'LOKÁLNÍ MEMORY'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white shadow-md">
                    {isAuthenticated && user ? user.name.slice(0, 2).toUpperCase() : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {isAuthenticated && user ? user.name : 'Nepřihlášený režim'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {isAuthenticated && user ? user.email : 'Data uložena lokálně'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                >
                  {isAuthenticated ? 'Správa účtu' : 'Přihlásit'}
                </button>
              </div>
            </div>

            {/* 2. Profil portfolia */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Aktivní profil portfolia
              </label>
              <div className="w-full">
                <ProfileSwitcher />
              </div>
              <p className="text-[11px] text-slate-500">
                Přepínejte mezi vlastním účtem, účtem partnera nebo společným rodinným portfoliem.
              </p>
            </div>

            {/* 3. Zobrazení & Preference */}
            <div className="space-y-3 pt-2 border-t border-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Zobrazení & Soukromí
              </span>

              {/* Měna */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Výchozí měna</span>
                    <span className="text-[10px] text-slate-400">Přepočet celého portfolia</span>
                  </div>
                </div>
                <CurrencySelect />
              </div>

              {/* Privacy Mode */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  {privacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Privacy Mode</span>
                    <span className="text-[10px] text-slate-400">Skryje částky na veřejnosti [klávesa P]</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={togglePrivacyMode}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    privacyMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {privacyMode ? 'Zapnuto' : 'Vypnuto'}
                </button>
              </div>

              {/* Cash Manager */}
              {onOpenCash && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Volná hotovost</span>
                      <span className="text-[10px] text-slate-400">Správa zůstatků v CZK, USD, EUR</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCash();
                    }}
                    className="px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all"
                  >
                    Upravit
                  </button>
                </div>
              )}
            </div>

            {/* 4. Tržní data & Refresh */}
            {holdingsCount > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Tržní data & Kurzy
                </span>
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Živé tržní ceny</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Poslední: {lastPriceRefreshAt || 'Zatím neaktualizováno'}
                    </span>
                  </div>
                  <button
                    onClick={() => refreshLivePrices()}
                    disabled={isRefreshingPrices}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingPrices ? 'Načítám...' : 'Aktualizovat'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. Servisní a záchranné akce */}
            <div className="space-y-3 pt-2 border-t border-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400/80 block">
                Správa dat & Servis
              </span>

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
                      onClose();
                    } catch (e: any) {
                      alert('Chyba při resetu a načtení výpisů: ' + (e.message || String(e)));
                    } finally {
                      setIsResetting(false);
                    }
                  }
                }}
                disabled={isResetting}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                  <div>
                    <span className="block font-bold">Čistě načíst demo výpisy</span>
                    <span className="text-[10px] text-rose-400/80 font-normal">7 výpisů Portu, Degiro, IBKR, XTB</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20">
                  {isResetting ? 'Pracuji...' : 'Reset'}
                </span>
              </button>

              {/* Clear data button */}
              {holdingsCount > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Opravdu chcete smazat všechna importovaná data aktuálního profilu?')) {
                      clearAllData();
                      onClose();
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-800/60 text-slate-400 hover:text-rose-300 text-xs font-medium transition-all text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="block">Vymazat data profilu</span>
                      <span className="text-[10px] text-slate-500">Smaže pozice tohoto profilu</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Smazat</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-500 font-mono text-center">
            Portfolio Tracker PRO • FIRE Edition
          </div>
        </div>
      </div>
    </div>
  );
};