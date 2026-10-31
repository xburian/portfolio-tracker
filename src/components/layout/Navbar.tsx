import React, { useEffect, useState } from 'react';
import {
  Upload,
  PieChart,
  SlidersHorizontal,
  Lock,
  Database,
  Coins,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { AuthModal } from '@/components/auth/AuthModal';
import { ToolsDrawer } from '@/components/layout/ToolsDrawer';

interface NavbarProps {
  onOpenImport: () => void;
  onOpenCash?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenImport, onOpenCash }) => {
  const privacyMode = usePreferencesStore((s) => s.privacyMode);
  const togglePrivacyMode = usePreferencesStore((s) => s.togglePrivacyMode);

  const holdingsCount = usePortfolioStore((s) => s.holdings.length);
  const isRefreshingPrices = usePortfolioStore((s) => s.isRefreshingPrices);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storageStatus = useAuthStore((s) => s.storageStatus);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0E14]/85 backdrop-blur-xl">
      <div className="max-w-[1720px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <PieChart className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-100 tracking-tight">Portfolio Tracker</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO • FIRE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block font-mono">
              {holdingsCount > 0 ? `${holdingsCount} otevřených pozic` : 'Připraveno k importu'}
            </p>
          </div>
        </div>

        {/* Lean Main Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Privacy badge if active */}
          {privacyMode && (
            <div
              onClick={togglePrivacyMode}
              title="Privacy mode je aktivní (Klávesa P)"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium cursor-pointer hover:bg-amber-500/20 transition-all"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Skryté částky</span>
            </div>
          )}

          {/* Currency Switcher */}
          <CurrencySelect />

          {/* Primary Action: Import */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nahrát výpis</span>
            <span className="sm:hidden">Import</span>
          </button>

          {/* Lean Tools & Drawer Trigger */}
          <button
            onClick={() => setToolsDrawerOpen(true)}
            title="Otevřít postranní panel nástrojů, profilů a nastavení"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/90 hover:border-slate-700 transition-all text-xs font-semibold text-slate-200 group"
          >
            {/* Status indicator inside button */}
            {isAuthenticated && user ? (
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-sm">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <SlidersHorizontal className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform" />
            )}

            <span className="hidden md:inline">
              {isAuthenticated && user ? user.name.split(' ')[0] : 'Nástroje'}
            </span>

            {/* Storage indicator badge */}
            <span
              className={`hidden sm:inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[9px] font-bold border ${
                isRedis
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {isRedis ? 'REDIS' : 'MEM'}
            </span>
          </button>
        </div>
      </div>

      {/* Slide-over Drawer for all secondary tools */}
      <ToolsDrawer
        open={toolsDrawerOpen}
        onClose={() => setToolsDrawerOpen(false)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenCash={onOpenCash}
      />

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </header>
  );
};
