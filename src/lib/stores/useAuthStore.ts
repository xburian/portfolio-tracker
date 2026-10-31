import { create } from 'zustand';

export type UserRole = 'admin' | 'user' | 'viewer';

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profileId: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StorageStatus {
  type: 'memory' | 'redis';
  connected: boolean;
  details?: string;
  keysCount?: number;
  entityBreakdown?: Record<string, number>;
  portfolioKeysCount?: number;
}

interface AuthState {
  user: UserPublic | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  storageStatus: StorageStatus | null;
  error: string | null;

  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  fetchStorageStatus: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  storageStatus: null,
  error: null,

  clearError: () => set({ error: null }),

  fetchStorageStatus: async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        set({
          storageStatus: {
            ...data.storage,
            entityBreakdown: data.entityBreakdown,
            portfolioKeysCount: data.portfolioKeysCount,
          },
        });
      }
    } catch {
      // ignore
    }
  },

  initAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      // 1. Fetch current authenticated user via session cookie or bearer token
      const res = await fetch('/api/auth/me', {
        headers: get().accessToken ? { Authorization: `Bearer ${get().accessToken}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true, isLoading: false });
      } else {
        // Try refreshing with refresh token cookie
        const refreshed = await get().refreshTokens();
        if (!refreshed) {
          set({ user: null, isAuthenticated: false, accessToken: null, isLoading: false });
        }
      }

      await get().fetchStorageStatus();
    } catch (err: any) {
      set({ user: null, isAuthenticated: false, accessToken: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || 'Přihlášení se nezdařilo', isLoading: false });
        return false;
      }

      set({
        user: data.user,
        accessToken: data.tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      await get().fetchStorageStatus();
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Chyba připojení k serveru', isLoading: false });
      return false;
    }
  },

  register: async (email: string, password: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || 'Registrace se nezdařila', isLoading: false });
        return false;
      }

      set({
        user: data.user,
        accessToken: data.tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      await get().fetchStorageStatus();
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Chyba připojení k serveru', isLoading: false });
      return false;
    }
  },

  refreshTokens: async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      const data = await res.json();
      set({
        user: data.user,
        accessToken: data.tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: get().accessToken ? { Authorization: `Bearer ${get().accessToken}` } : {},
      });
    } catch {
      // ignore
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false, error: null });
      await get().fetchStorageStatus();
    }
  },
}));
