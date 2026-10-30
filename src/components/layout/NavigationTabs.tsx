import React from 'react';
import { LayoutDashboard, Layers, PieChart, Sparkles, TrendingUp } from 'lucide-react';
import { ActiveTab, usePreferencesStore } from '@/lib/stores/usePreferencesStore';

export const NavigationTabs: React.FC = () => {
  const activeTab = usePreferencesStore((s) => s.activeTab);
  const setActiveTab = usePreferencesStore((s) => s.setActiveTab);

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Přehled', icon: LayoutDashboard },
    { id: 'holdings', label: 'Pozice a akcie', icon: Layers },
    { id: 'breakdown', label: 'Vizuální rozpad', icon: PieChart },
    { id: 'clusters', label: 'Klastry & Pravidla', icon: Sparkles },
    { id: 'projection', label: 'Simulátor 5–30 let', icon: TrendingUp },
  ];

  return (
    <div className="w-full border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
      <div className="max-w-[1720px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <nav className="flex items-center space-x-1 sm:space-x-4 overflow-x-auto scrollbar-none py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
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
        </nav>
      </div>
    </div>
  );
};
