import { create } from 'zustand';
import { db, DEFAULT_PROFILE_ID } from '@/types/../lib/db';
import { CashflowSnapshot, ExpenseCategory, SalaryConfig } from '@/types/budget';
import { BudgetService } from '@/lib/services/budgetService';
import { ServerSyncService } from '@/lib/services/serverSyncService';

interface BudgetState {
  profileId: string;
  salaryConfig: SalaryConfig;
  expenses: ExpenseCategory[];
  isLoading: boolean;

  initBudget: (profileId?: string) => Promise<void>;
  updateSalaryConfig: (partial: Partial<SalaryConfig>) => Promise<void>;
  addExpenseCategory: (expense: Omit<ExpenseCategory, 'id' | 'profileId'>) => Promise<void>;
  updateExpenseCategory: (id: string, partial: Partial<ExpenseCategory>) => Promise<void>;
  deleteExpenseCategory: (id: string) => Promise<void>;

  getCashflowSnapshot: () => CashflowSnapshot;
}

const DEFAULT_SALARY: SalaryConfig = {
  profileId: DEFAULT_PROFILE_ID,
  baseMonthlyNetSalaryCZK: 85000,
  paydayDayOfMonth: 15,
  annualIncreasePercentage: 5.0,
  increaseMonth: 1,
  bonuses: [
    { id: 'bonus-13', name: '13. plat / Vánoční bonus', month: 11, amountNetCZK: 50000, isRecurringAnnual: true }
  ],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_EXPENSES: ExpenseCategory[] = [
  { id: 'exp_housing', profileId: DEFAULT_PROFILE_ID, name: 'Bydlení & Nájem', monthlyAmountCZK: 25000, isEssential: true, colorHex: '#EF4444', annualInflationPercentage: 4.0 },
  { id: 'exp_food', profileId: DEFAULT_PROFILE_ID, name: 'Jídlo & Potraviny', monthlyAmountCZK: 12000, isEssential: true, colorHex: '#F59E0B', annualInflationPercentage: 3.5 },
  { id: 'exp_utilities', profileId: DEFAULT_PROFILE_ID, name: 'Internet, Energie & Služby', monthlyAmountCZK: 6500, isEssential: true, colorHex: '#3B82F6', annualInflationPercentage: 3.0 },
  { id: 'exp_transport', profileId: DEFAULT_PROFILE_ID, name: 'Doprava & Auto', monthlyAmountCZK: 5000, isEssential: true, colorHex: '#10B981', annualInflationPercentage: 2.5 },
  { id: 'exp_leisure', profileId: DEFAULT_PROFILE_ID, name: 'Zábava, Sport & Ostatní', monthlyAmountCZK: 7500, isEssential: false, colorHex: '#8B5CF6', annualInflationPercentage: 3.0 },
];

export const useBudgetStore = create<BudgetState>((set, get) => ({
  profileId: DEFAULT_PROFILE_ID,
  salaryConfig: DEFAULT_SALARY,
  expenses: DEFAULT_EXPENSES,
  isLoading: false,

  initBudget: async (profileId = DEFAULT_PROFILE_ID) => {
    set({ isLoading: true, profileId });
    try {
      let salary = await db.salaryConfigs.get(profileId);
      if (!salary) {
        salary = { ...DEFAULT_SALARY, profileId };
        await db.salaryConfigs.put(salary);
      }

      let expList = await db.expenseCategories.where('profileId').equals(profileId).toArray();
      if (expList.length === 0) {
        for (const exp of DEFAULT_EXPENSES) {
          const item = { ...exp, profileId, id: `${exp.id}_${profileId}` };
          await db.expenseCategories.put(item);
        }
        expList = await db.expenseCategories.where('profileId').equals(profileId).toArray();
      }

      set({ salaryConfig: salary, expenses: expList, isLoading: false });
      ServerSyncService.pushToBackend().catch(console.warn);
    } catch (err) {
      console.error('Failed to load budget from Dexie:', err);
      set({ isLoading: false });
    }
  },

  updateSalaryConfig: async (partial) => {
    const { salaryConfig, profileId } = get();
    const updated: SalaryConfig = {
      ...salaryConfig,
      ...partial,
      profileId,
      updatedAt: new Date().toISOString(),
    };
    await db.salaryConfigs.put(updated);
    set({ salaryConfig: updated });
    ServerSyncService.pushToBackend().catch(console.warn);
  },

  addExpenseCategory: async (expense) => {
    const { profileId, expenses } = get();
    const newId = `exp_${Date.now()}`;
    const newCategory: ExpenseCategory = {
      ...expense,
      id: newId,
      profileId,
    };
    await db.expenseCategories.put(newCategory);
    set({ expenses: [...expenses, newCategory] });
    ServerSyncService.pushToBackend().catch(console.warn);
  },

  updateExpenseCategory: async (id, partial) => {
    const { expenses } = get();
    const updated = expenses.map(e => e.id === id ? { ...e, ...partial } : e);
    const target = updated.find(e => e.id === id);
    if (target) {
      await db.expenseCategories.put(target);
    }
    set({ expenses: updated });
    ServerSyncService.pushToBackend().catch(console.warn);
  },

  deleteExpenseCategory: async (id) => {
    const { expenses } = get();
    await db.expenseCategories.delete(id);
    set({ expenses: expenses.filter(e => e.id !== id) });
    ServerSyncService.pushToBackend().catch(console.warn);
  },

  getCashflowSnapshot: () => {
    const { salaryConfig, expenses } = get();
    return BudgetService.calculateCashflowSnapshot(salaryConfig, expenses);
  },
}));
