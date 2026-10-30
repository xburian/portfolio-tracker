import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Wallet, Coins, Plus, Trash2, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { CurrencyService } from '@/lib/services/currencyService';
import { CurrencyCode, BrokerId } from '@/types/portfolio';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

interface CashManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['CZK', 'USD', 'EUR', 'GBP'];

export const CashManagerModal: React.FC<CashManagerModalProps> = ({ open, onOpenChange }) => {
  const accounts = usePortfolioStore((s) => s.accounts);
  const updateAccountCash = usePortfolioStore((s) => s.updateAccountCash);
  const addCashAccount = usePortfolioStore((s) => s.addCashAccount);
  const deleteAccount = usePortfolioStore((s) => s.deleteAccount);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

  // Local state for account balances: accountId -> { CZK: number, USD: number, EUR: number, GBP: number }
  const [balances, setBalances] = useState<Record<string, Record<CurrencyCode, number>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New account form state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState<CurrencyCode>('CZK');
  const [newAccAmount, setNewAccAmount] = useState<string>('0');
  const [newAccType, setNewAccType] = useState<BrokerId>('BANK');

  useEffect(() => {
    if (open) {
      const initial: Record<string, Record<CurrencyCode, number>> = {};
      for (const acc of accounts) {
        initial[acc.id] = {
          CZK: acc.cashBalances?.CZK || 0,
          USD: acc.cashBalances?.USD || 0,
          EUR: acc.cashBalances?.EUR || 0,
          GBP: acc.cashBalances?.GBP || 0,
        };
      }
      setBalances(initial);
      setSaveSuccess(false);
    }
  }, [open, accounts]);

  const handleBalanceChange = (accountId: string, currency: CurrencyCode, rawValue: string) => {
    const val = parseFloat(rawValue) || 0;
    setBalances((prev) => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || { CZK: 0, USD: 0, EUR: 0, GBP: 0 }),
        [currency]: val,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [accId, accBalances] of Object.entries(balances)) {
        await updateAccountCash(accId, accBalances);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onOpenChange(false);
      }, 700);
    } catch (e) {
      console.error('Failed to save cash balances:', e);
      alert('Chyba při ukládání hotovosti: ' + e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccName.trim()) return;
    const initialAmt = parseFloat(newAccAmount) || 0;
    const newBalances: Record<CurrencyCode, number> = { CZK: 0, USD: 0, EUR: 0, GBP: 0 };
    newBalances[newAccCurrency] = initialAmt;

    await addCashAccount(newAccName.trim(), newBalances, newAccType);
    setNewAccName('');
    setNewAccAmount('0');
    setShowAddAccount(false);
  };

  const handleDeleteCustomAccount = async (accountId: string) => {
    if (window.confirm('Opravdu chcete odebrat tento hotovostní/bankovní účet?')) {
      await deleteAccount(accountId);
    }
  };

  // Grand total in display currency
  const totalCashDisplay = Object.values(balances).reduce((sum, b) => {
    let accSum = 0;
    for (const [curr, amt] of Object.entries(b || {})) {
      if (amt && amt > 0) {
        const rate = CurrencyService.getRate(curr as CurrencyCode, displayCurrency);
        accSum += amt * rate;
      }
    }
    return sum + accSum;
  }, 0);

  // Totals by currency
  const currencyTotals: Record<CurrencyCode, number> = { CZK: 0, USD: 0, EUR: 0, GBP: 0 };
  for (const b of Object.values(balances)) {
    for (const [curr, amt] of Object.entries(b || {})) {
      const c = curr as CurrencyCode;
      currencyTotals[c] = (currencyTotals[c] || 0) + (amt || 0);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-[#0F1420] border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Správa volné hotovosti</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Kč, USD, EUR, GBP
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  Zůstatky se automaticky připočítávají do celkové hodnoty portfolia (NAV) a alokace aktiv
                </Dialog.Description>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="px-6 py-3.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              <span className="text-[11px] text-slate-400 font-mono block">Celková hotovost portfolia:</span>
              <MoneyDisplay
                amount={totalCashDisplay}
                className="text-xl font-bold text-slate-100 tracking-tight"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currencyTotals.CZK > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700/80 text-xs font-mono text-slate-200">
                  {currencyTotals.CZK.toLocaleString('cs-CZ')} Kč
                </span>
              )}
              {currencyTotals.USD > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300">
                  ${currencyTotals.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              )}
              {currencyTotals.EUR > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono text-cyan-300">
                  {currencyTotals.EUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              )}
              {currencyTotals.GBP > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-purple-300">
                  £{currencyTotals.GBP.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Accounts List */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Zůstatky podle účtů & brokerů ({accounts.length})
              </span>
              <button
                onClick={() => setShowAddAccount(!showAddAccount)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddAccount ? 'Zavřít formulář' : 'Přidat banku / hotovost'}</span>
              </button>
            </div>

            {/* Add Custom Bank/Cash Account Card */}
            {showAddAccount && (
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 animate-in fade-in space-y-3">
                <p className="text-xs font-bold text-indigo-200">Nový bankovní nebo hotovostní účet</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-1">Název účtu</label>
                    <input
                      type="text"
                      placeholder="např. Spořicí účet CZK, Revolut USD"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Měna</label>
                    <select
                      value={newAccCurrency}
                      onChange={(e) => setNewAccCurrency(e.target.value as CurrencyCode)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Zůstatek</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newAccAmount}
                      onChange={(e) => setNewAccAmount(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddAccount(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleCreateAccount}
                    disabled={!newAccName.trim()}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-all"
                  >
                    Vytvořit účet
                  </button>
                </div>
              </div>
            )}

            {/* List of Accounts */}
            {accounts.map((acc) => {
              const accBalances = balances[acc.id] || { CZK: 0, USD: 0, EUR: 0, GBP: 0 };
              const isCustomBank = acc.brokerId === 'BANK' || acc.brokerId === 'CASH';

              // Convert this account's cash to target currency
              const accTotalConverted = Object.entries(accBalances).reduce((sum, [curr, amt]) => {
                if (amt && amt > 0) {
                  return sum + amt * CurrencyService.getRate(curr as CurrencyCode, displayCurrency);
                }
                return sum;
              }, 0);

              return (
                <div
                  key={acc.id}
                  className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/70 flex items-center justify-center font-mono font-bold text-xs text-indigo-400">
                        {acc.brokerId}
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-100">{acc.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          Účet: {acc.accountNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-mono">Hodnota hotovosti:</span>
                        <MoneyDisplay
                          amount={accTotalConverted}
                          className="text-xs font-bold text-slate-200"
                        />
                      </div>
                      {isCustomBank && (
                        <button
                          onClick={() => handleDeleteCustomAccount(acc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors"
                          title="Smazat tento účet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-currency inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 font-mono text-xs">
                    {(['CZK', 'USD', 'EUR', 'GBP'] as CurrencyCode[]).map((curr) => {
                      const amount = accBalances[curr] || 0;
                      return (
                        <div key={curr} className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-sans flex items-center justify-between">
                            <span>{curr}</span>
                            {amount > 0 && curr !== displayCurrency && (
                              <span className="text-[9px] text-slate-500">
                                ≈ {Math.round(amount * CurrencyService.getRate(curr, displayCurrency)).toLocaleString()} {displayCurrency}
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={amount === 0 ? '' : amount}
                            placeholder="0"
                            onChange={(e) => handleBalanceChange(acc.id, curr, e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none transition-colors ${
                              amount > 0
                                ? 'bg-indigo-950/20 border-indigo-500/40 text-slate-100 font-semibold'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 bg-[#0B0E14] border-t border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Změny se ihned uloží a přepočtou celou aplikaci</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Zavřít
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Uloženo!</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>{isSaving ? 'Ukládám...' : 'Uložit zůstatky'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
