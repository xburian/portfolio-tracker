import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Lock,
  User,
  Mail,
  KeyRound,
  ShieldCheck,
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/useAuthStore';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange }) => {
  const [tab, setTab] = useState<'login' | 'register' | 'storage'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const storageStatus = useAuthStore((s) => s.storageStatus);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);
  const fetchStorageStatus = useAuthStore((s) => s.fetchStorageStatus);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(email, password);
    if (ok) {
      setActionSuccess('Úspěšně přihlášeno!');
      setTimeout(() => {
        setActionSuccess(null);
        onOpenChange(false);
      }, 1000);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await register(email, password, name);
    if (ok) {
      setActionSuccess('Účet byl úspěšně vytvořen a přihlášen!');
      setTimeout(() => {
        setActionSuccess(null);
        onOpenChange(false);
      }, 1000);
    }
  };

  const handleQuickDemoFill = () => {
    setEmail('lukas@burian.cz');
    setPassword('portfolio2026');
    clearError();
  };

  const isRedis = storageStatus?.type === 'redis';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl bg-[#0F1420] border border-slate-800 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-100 tracking-tight">
                  {isAuthenticated ? 'Správa uživatele & Úložiště' : 'Přihlášení do aplikace'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  JWT autorizace, refresh tokeny a persistentní storage
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                onClick={() => clearError()}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Navigation Tabs */}
          {!isAuthenticated && (
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium my-4">
              <button
                onClick={() => {
                  setTab('login');
                  clearError();
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  tab === 'login' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Přihlášení
              </button>
              <button
                onClick={() => {
                  setTab('register');
                  clearError();
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  tab === 'register' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nová registrace
              </button>
              <button
                onClick={() => {
                  setTab('storage');
                  fetchStorageStatus();
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  tab === 'storage' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Redis & Tokeny
              </button>
            </div>
          )}

          {/* Error & Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 my-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="flex items-center gap-2 p-3 my-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* ALREADY AUTHENTICATED VIEW */}
          {isAuthenticated && user && (
            <div className="flex flex-col gap-4 py-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100 block text-sm">{user.name}</span>
                    <span className="text-xs text-slate-400 block font-mono">{user.email}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase font-semibold">
                    {user.role}
                  </span>
                  <span className="text-[10px] text-slate-400">Aktivní relace</span>
                </div>
              </div>

              {/* Token Info & Storage */}
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>JWT Access Token:</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-medium">Platnost 15 minut</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Refresh Token:</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-medium">7 dní (rotace při použití)</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Typ úložiště:</span>
                  </span>
                  <span className="font-mono text-slate-200 font-medium">
                    {storageStatus?.type === 'redis' ? 'Produkční Redis' : 'Lokální In-Memory'}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={async () => {
                  await logout();
                  onOpenChange(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700/60 text-xs font-semibold transition-colors mt-2"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Odhlásit se</span>
              </button>
            </div>
          )}

          {/* LOGIN TAB */}
          {!isAuthenticated && tab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3 py-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.cz"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Heslo</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={handleQuickDemoFill}
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Vyplnit demo (Lukáš Burian)</span>
                </button>
                <span className="text-slate-500">demo: portfolio2026</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isLoading ? 'Ověřuji...' : 'Přihlásit se'}
              </button>
            </form>
          )}

          {/* REGISTER TAB */}
          {!isAuthenticated && tab === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3 py-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Jméno a příjmení</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="např. Jan Novák"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.cz"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Heslo (min. 6 znaků)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isLoading ? 'Vytvářím účet...' : 'Zaregistrovat se'}
              </button>
            </form>
          )}

          {/* STORAGE & REDIS DIAGNOSTICS TAB */}
          {!isAuthenticated && tab === 'storage' && (
            <div className="flex flex-col gap-3 py-1">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aktuální režim úložiště:</span>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                      isRedis
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}
                  >
                    {isRedis ? 'Redis Storage (Persistent)' : 'In-Memory Storage (Local)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {storageStatus?.details || 'Lokální in-memory adaptér s TTL expirací tokenů.'}
                </p>
                {storageStatus?.keysCount !== undefined && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Aktivní záznamy v úložišti: {storageStatus.keysCount}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Přepnutí na produkční Redis:</span>
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pro nasazení v cloudu nebo s persistentním Redisem stačí v prostředí nastavit proměnnou:
                </p>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 select-all">
                  REDIS_URL=redis://default:heslo@host:port
                </div>
                <p className="text-[10px] text-slate-400">
                  Pokud Redis není dostupný, server automaticky a bezpečně přejde na In-Memory běh.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchStorageStatus()}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Obnovit stav úložiště</span>
              </button>
            </div>
          )}

          {/* Footer Info Pill */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  isRedis ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-indigo-400'
                }`}
              />
              <span>{isRedis ? 'Redis db připojena' : 'In-Memory úložiště'}</span>
            </div>
            <span className="font-mono">JWT + Refresh tokeny</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
