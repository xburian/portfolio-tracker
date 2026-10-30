import React, { useState } from 'react';
import { useBudgetStore } from '@/lib/stores/useBudgetStore';
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore';
import { useCurrencyStore } from '@/lib/stores/useCurrencyStore';
import { ExpenseCategory, SalaryBonusConfig } from '@/types/budget';
import { WalletCards, Plus, Trash2, Edit2, Check, TrendingUp, Calendar, AlertCircle, ArrowRight, Shield, Sparkles } from 'lucide-react';

export const BudgetPlanner: React.FC = () => {
  const salaryConfig = useBudgetStore((s) => s.salaryConfig);
  const expenses = useBudgetStore((s) => s.expenses);
  const updateSalaryConfig = useBudgetStore((s) => s.updateSalaryConfig);
  const addExpenseCategory = useBudgetStore((s) => s.addExpenseCategory);
  const updateExpenseCategory = useBudgetStore((s) => s.updateExpenseCategory);
  const deleteExpenseCategory = useBudgetStore((s) => s.deleteExpenseCategory);
  const getCashflowSnapshot = useBudgetStore((s) => s.getCashflowSnapshot);
  const setActiveTab = usePreferencesStore((s) => s.setActiveTab);
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const formatCurrency = useCurrencyStore((s) => s.formatCurrency);

  const snapshot = getCashflowSnapshot();

  // Salary editing states
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [tempSalary, setTempSalary] = useState(salaryConfig.baseMonthlyNetSalaryCZK);
  const [tempPayday, setTempPayday] = useState(salaryConfig.paydayDayOfMonth);
  const [tempIncrease, setTempIncrease] = useState(salaryConfig.annualIncreasePercentage);

  // New expense state
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState<number>(3000);
  const [newExpEssential, setNewExpEssential] = useState(true);

  // New bonus state
  const [isAddingBonus, setIsAddingBonus] = useState(false);
  const [bonusName, setBonusName] = useState('');
  const [bonusMonth, setBonusMonth] = useState(12);
  const [bonusAmount, setBonusAmount] = useState(50000);

  const handleSaveSalary = async () => {
    await updateSalaryConfig({
      baseMonthlyNetSalaryCZK: Number(tempSalary),
      paydayDayOfMonth: Number(tempPayday),
      annualIncreasePercentage: Number(tempIncrease),
    });
    setIsEditingSalary(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpName.trim() || newExpAmount <= 0) return;
    await addExpenseCategory({
      name: newExpName.trim(),
      monthlyAmountCZK: Number(newExpAmount),
      isEssential: newExpEssential,
      colorHex: newExpEssential ? '#3B82F6' : '#8B5CF6',
    });
    setNewExpName('');
    setNewExpAmount(3000);
    setIsAddingExpense(false);
  };

  const handleAddBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusName.trim() || bonusAmount <= 0) return;
    const newBonus: SalaryBonusConfig = {
      id: `bonus_${Date.now()}`,
      name: bonusName.trim(),
      month: Number(bonusMonth),
      amountNetCZK: Number(bonusAmount),
      isRecurringAnnual: true,
    };
    await updateSalaryConfig({
      bonuses: [...(salaryConfig.bonuses || []), newBonus],
    });
    setBonusName('');
    setIsAddingBonus(false);
  };

  const handleRemoveBonus = async (id: string) => {
    const updated = (salaryConfig.bonuses || []).filter(b => b.id !== id);
    await updateSalaryConfig({ bonuses: updated });
  };

  return (
    <div className="space-y-6">
      {/* 1. Hlavní KPI přehled cashflow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Čistá mzda + výplata 15. */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Čistá mzda z práce</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold">
              Výplata 15.
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {formatCurrency(snapshot.monthlyNetSalaryCZK, displayCurrency)}
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Do výplaty zbývá: <strong className="text-white">{snapshot.daysUntilPayday} dní</strong></span>
          </p>
        </div>

        {/* Měsíční výdaje */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Měsíční výdaje</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold">
              {expenses.length} kategorií
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-400">
            -{formatCurrency(snapshot.totalMonthlyExpensesCZK, displayCurrency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mandatorní: {formatCurrency(snapshot.essentialExpensesCZK, displayCurrency)}
          </p>
        </div>

        {/* Volná investiční kapacita */}
        <div className="bg-gradient-to-br from-slate-900/80 to-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Investiční kapacita</span>
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
            +{formatCurrency(snapshot.netInvestableCapacityCZK, displayCurrency)} <span className="text-xs font-normal text-slate-400">/ měs</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Volný měsíční cashflow po zaplacení všech výdajů
          </p>
        </div>

        {/* Míra úspor (Savings Rate) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Míra úspor (Savings Rate)</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {snapshot.savingsRatePercentage.toFixed(1)} %
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Podíl příjmů směřující do budování bohatství
            </p>
          </div>

          <div className="mt-3 pt-2">
            <button
              onClick={() => setActiveTab('projection')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold transition-all border border-emerald-500/30"
            >
              <span>Simulovat predikci s touto kapacitou</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dvě sekce: Mzda & Kariérní eskalátor vlevo, Výdaje vpravo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Karta Mzdy a Kariérního růstu */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Zaměstnání, Mzda & Kariérní růst</h3>
              <p className="text-xs text-slate-400">Parametry pravidelného příjmu a roční valorizace</p>
            </div>
            {!isEditingSalary ? (
              <button
                onClick={() => {
                  setTempSalary(salaryConfig.baseMonthlyNetSalaryCZK);
                  setTempPayday(salaryConfig.paydayDayOfMonth);
                  setTempIncrease(salaryConfig.annualIncreasePercentage);
                  setIsEditingSalary(true);
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Upravit mzdu</span>
              </button>
            ) : (
              <button
                onClick={handleSaveSalary}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Uložit</span>
              </button>
            )}
          </div>

          {isEditingSalary ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Čistá mzda (Kč)</label>
                <input
                  type="number"
                  value={tempSalary}
                  onChange={(e) => setTempSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Den výplaty v měsíci</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={tempPayday}
                  onChange={(e) => setTempPayday(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Roční valorizace (% p.a.)</label>
                <input
                  type="number"
                  step="0.5"
                  value={tempIncrease}
                  onChange={(e) => setTempIncrease(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Základní čistá mzda</span>
                <span className="text-sm font-bold text-white">{formatCurrency(salaryConfig.baseMonthlyNetSalaryCZK, displayCurrency)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Výplatní den</span>
                <span className="text-sm font-bold text-indigo-400">{salaryConfig.paydayDayOfMonth}. v měsíci</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Kariérní růst</span>
                <span className="text-sm font-bold text-emerald-400">+{salaryConfig.annualIncreasePercentage.toFixed(1)} % ročně</span>
              </div>
            </div>
          )}

          {/* Bonusy a 13. plat */}
          <div className="pt-3 border-t border-slate-800/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mimořádné bonusy & 13. plat</span>
              <button
                onClick={() => setIsAddingBonus(!isAddingBonus)}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Přidat bonus</span>
              </button>
            </div>

            {isAddingBonus && (
              <form onSubmit={handleAddBonus} className="p-3 mb-3 rounded-xl bg-slate-800/60 border border-slate-700 flex flex-wrap gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Název (např. 13. plat)"
                  value={bonusName}
                  onChange={(e) => setBonusName(e.target.value)}
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
                  required
                />
                <select
                  value={bonusMonth}
                  onChange={(e) => setBonusMonth(Number(e.target.value))}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}. měsíc</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Částka v čistém"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(Number(e.target.value))}
                  className="w-28 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500"
                >
                  Přidat
                </button>
              </form>
            )}

            <div className="space-y-2">
              {(salaryConfig.bonuses || []).map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800/60 text-xs">
                  <div>
                    <span className="font-semibold text-white">{b.name}</span>
                    <span className="text-slate-400 text-[11px] ml-2">Vypláceno v {b.month}. měsíci</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">+{formatCurrency(b.amountNetCZK, displayCurrency)}</span>
                    <button
                      onClick={() => handleRemoveBonus(b.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {(salaryConfig.bonuses || []).length === 0 && (
                <div className="text-xs text-slate-500 py-2">Žádné nastavené bonusy</div>
              )}
            </div>
          </div>
        </div>

        {/* Karta Pravidelných výdajů */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Pravidelné měsíční výdaje</h3>
              <p className="text-xs text-slate-400">Nájem, energie, jídlo, internet a služby</p>
            </div>
            <button
              onClick={() => setIsAddingExpense(!isAddingExpense)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Přidat výdaj</span>
            </button>
          </div>

          {isAddingExpense && (
            <form onSubmit={handleAddExpense} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Název kategorie výdaje</label>
                  <input
                    type="text"
                    placeholder="např. Posilovna / Netflix"
                    value={newExpName}
                    onChange={(e) => setNewExpName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Měsíční částka (Kč)</label>
                  <input
                    type="number"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newExpEssential}
                    onChange={(e) => setNewExpEssential(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Mandatorní (nezbytný) životní výdaj</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500"
                  >
                    Uložit výdaj
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: exp.colorHex || (exp.isEssential ? '#EF4444' : '#8B5CF6') }}
                  />
                  <div>
                    <span className="font-semibold text-white">{exp.name}</span>
                    <span className="text-[10px] text-slate-400 block">
                      {exp.isEssential ? 'Mandatorní' : 'Zbytný'} {exp.annualInflationPercentage ? `• Inflace ${exp.annualInflationPercentage}%` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-rose-400">
                    -{formatCurrency(exp.monthlyAmountCZK, displayCurrency)}
                  </span>
                  <button
                    onClick={() => deleteExpenseCategory(exp.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {expenses.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                Žádné zadané výdaje. Klikněte na Přidat výdaj.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
