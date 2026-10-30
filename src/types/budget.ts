export interface SalaryBonusConfig {
  id: string;
  name: string;                       // e.g. "13. plat / Vánoční bonus", "Q4 bonus"
  month: number;                      // 1 to 12
  amountNetCZK: number;               // Částka bonusu v čistém v CZK
  isRecurringAnnual: boolean;         // Opakuje se každý rok
}

export interface SalaryConfig {
  profileId: string;                  // Vazba na profil uživatele
  baseMonthlyNetSalaryCZK: number;    // Čistá měsíční mzda (např. 85 000 CZK)
  paydayDayOfMonth: number;           // Den výplaty v měsíci (výchozí: 15)
  annualIncreasePercentage: number;   // Roční nárůst mzdy v % (např. 5.0 %)
  increaseMonth: number;              // Měsíc valorizace (1 = leden)
  bonuses: SalaryBonusConfig[];
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;                         // např. "exp_housing"
  profileId: string;
  name: string;                       // "Bydlení & Nájem", "Jídlo & Potraviny", "Internet, Energie & Služby"
  monthlyAmountCZK: number;           // Měsíční částka v CZK
  isEssential: boolean;               // Mandatorní vs zbytný výdaj
  colorHex: string;
  annualInflationPercentage?: number;// Individuální inflace kategorie (např. 3.5 %)
}

export interface CashflowSnapshot {
  monthlyNetSalaryCZK: number;
  monthlyBonusesCZK: number;          // Poměrný nebo měsíční bonus
  totalMonthlyExpensesCZK: number;
  essentialExpensesCZK: number;
  discretionaryExpensesCZK: number;
  netInvestableCapacityCZK: number;   // Mzda + Bonusy - Výdaje
  savingsRatePercentage: number;      // (Kapacita / Mzda) * 100
  daysUntilPayday: number;            // Dny zbývající do 15. v měsíci
}

export interface WealthProjectionConfig {
  horizonYears: 1 | 3 | 5 | 10 | 20 | 30;
  initialNetWorthCZK: number;
  initialStocksCZK?: number;
  initialSavingsCZK?: number;
  monthlyInvestableSurplusCZK: number;
  expectedStockReturnPercent: number; // e.g. 10.0 % p.a.
  expectedSavingsReturnPercent?: number; // e.g. 4.0 % p.a. na spořícím účtu
  stockAllocationPercent?: number; // Kolik % z volné kapacity jde do akcií (např. 70 %, zbytek 30 % na spořák)
  expectedSalaryGrowthPercent: number;// e.g. 5.0 % p.a.
  expectedExpenseInflationPercent: number; // e.g. 3.0 % p.a.
  dividendYieldPercent: number;       // e.g. 2.0 % p.a.
  dripEnabled: boolean;               // Reinvestovat dividendy
  savingsReinvestmentRatePercent: number; // Kolik % z volné kapacity se odkládá celkem (výchozí: 100 %)
}

export interface MonthlyWealthProjectionPoint {
  month: number;                      // 1 až 120
  yearMonthLabel: string;             // "Rok 1, Měsíc 6"
  salaryCZK: number;
  expensesCZK: number;
  investedSurplusCZK: number;
  cumulativeInvestedCZK: number;      // Vlastní vklady celkem
  portfolioValueCZK: number;          // Celková hodnota majetku (akcie + spořák)
  reinvestedDividendsCZK: number;     // Kumulované reinvestované dividendy
  compoundGrowthCZK: number;          // Čistý zisk celkem ze složeného úročení

  // Rozdělení na 2 položky: Investice (Akcie & ETF) vs. Spořící účet
  stocksValueCZK: number;
  stocksInvestedCZK: number;
  stocksCompoundGainCZK: number;

  savingsValueCZK: number;
  savingsInvestedCZK: number;
  savingsInterestCZK: number;
}
