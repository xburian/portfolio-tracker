import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActiveTab = 'dashboard' | 'holdings' | 'breakdown' | 'clusters' | 'projection';

interface PreferencesState {
  privacyMode: boolean;
  activeTab: ActiveTab;
  togglePrivacyMode: () => void;
  setPrivacyMode: (val: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      privacyMode: false,
      activeTab: 'dashboard',
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    { name: 'fintech-portfolio-preferences' }
  )
);
