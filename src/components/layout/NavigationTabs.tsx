import React from 'react';
import {
  LayoutDashboard,
  Layers,
  PieChart,
  Sparkles,
  TrendingUp,
  WalletCards,
  BadgePercent,
  ChevronDown,
  Wrench,
  Check,
  Scale,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ActiveTab, usePreferencesStore } from '@/lib/stores/usePreferencesStore';

export const NavigationTabs: React.FC = () => {
  const activeTab = usePreferencesStore((s) => s.activeTab);
  const setActiveTab = usePreferencesStore((s) => s.setActiveTab);

  const primaryTabs: Array<{ id: ActiveTab; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Přehled & Denní změny', icon: LayoutDashboard },
    { id: 'holdings', label: 'Pozice a akcie', icon: Layers },
    { id: 'budget', label: 'Rozpočet & Mzda', icon: WalletCards },
    { id: 'dividends', label: 'Dividendy', icon: BadgePercent },
    { id: 'projection', label: 'Predikce bohatství', icon: TrendingUp },
  ];

  const toolTabs: Array<{
    id: ActiveTab;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    {
      id: 'breakdown',
      label: 'Vizuální rozpad',
      description: 'Koláčový rozpad tříd aktiv a 3letý daňový test (§ 4 ZDP)',
      icon: PieChart,
    },
    {
      id: 'tax',
      label: 'Daně & Optimalizace',
      description: 'Rozpad dle výpisů brokerů, DPFO (§ 8, § 10) a Tax-Loss Harvesting',
      icon: Scale,
    },
    {
      id: 'clusters',
      label: 'Klastry & Pravidla',
      description: 'Slučování ekvivalentních ETF (např. SXR8 i VUAA) a auto-pravidla',
      icon: Sparkles,
    },
  ];

  const activeTool = toolTabs.find((t) => t.id === activeTab);
  const isToolActive = !!activeTool;

  return (
    <div className="w-full border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
      <div className="max-w-[1720px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none py-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-indigo-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Expandující tab pro nástroje (Nástroje ▾) */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap border cursor-pointer ${
                  isToolActive
                    ? 'bg-slate-800 text-indigo-400 border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent'
                }`}
              >
                {activeTool ? (
                  <activeTool.icon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Wrench className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {activeTool ? `Nástroje: ${activeTool.label}` : 'Nástroje'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={8}
                className="z-50 w-72 rounded-2xl bg-[#0D1117] border border-slate-800 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
              >
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Pokročilé nástroje & analýzy
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  {toolTabs.map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeTab === item.id;
                    return (
                      <DropdownMenu.Item
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl text-xs cursor-pointer outline-none transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600/30 text-indigo-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold block">{item.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </DropdownMenu.Item>
                    );
                  })}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>
      </div>
    </div>
  );
};
