# 📈 Portfolio Tracker PRO • FIRE & Wealth Command Center

[![CI](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Bun](https://img.shields.io/badge/Bun-v1.4-fbf0df.svg)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-108%20passed%20(2017%20assertions)-emerald.svg)](https://github.com/xburian/portfolio-tracker)

A comprehensive, institutional-grade personal wealth and investment management platform engineered specifically for retail investors and individuals pursuing **Financial Independence, Retire Early (FIRE)** in the Czech Republic and the European Union.

Portfolio Tracker aggregates multi-broker statements (**XTB**, **DEGIRO**, **Interactive Brokers**, **Portu**, bank accounts, and physical cash), automates Czech tax compliance (**§ 4, § 8, § 10, § 38v ZDP**), provides water-filling **Smart DCA buy-only rebalancing**, simulates multi-decade wealth trajectory with career growth, and tracks real-world investment performance.

---

## 🌟 Key Features & Modules

### 1. 🏛️ Czech Tax Assistant & Exemption Radar (§ 4, § 8, § 10, § 38v ZDP)
- **100 000 CZK Gross Sales Exemption Radar (§ 4(1)(v) ZDP):**
  - Live progress meter tracking total gross revenue from non-exempt securities sales within the calendar year.
  - Highlights tax-free status when under 100 000 CZK, with instant alerts if approaching or crossing the cliff threshold into taxable territory.
- **5 000 000 CZK Notification Duty Monitor (§ 38v ZDP):**
  - Monitors tax-exempt proceeds (after the 3-year time test). Automatically triggers compliance alerts when any exempt trade or aggregate exceeds 5 000 000 CZK to prevent penalties of up to 15%.
- **§ 10 Tax Base Calculation (Příloha č. 2 DPFO):**
  - Matches purchases and sales via FIFO with transaction fee deduction.
  - Netted capital gains and losses across trades within the tax year.
  - Strict 0 CZK floor enforcement (capital losses on securities cannot offset employment salary or carry forward).
- **Foreign Dividend Withholding Tax Credit (§ 8 ZDP / Příloha č. 3):**
  - Country-by-country breakdown of gross dividends and foreign withholding tax paid.
  - Applies Double Taxation Treaties (DTT / SZDZ, e.g., 15% rate under US W-8BEN) with simple credit method calculation (*metoda prostého zápočtu*).
- **Exchange Rate Modes & CSV Export:**
  - One-click toggle between **Pokyn GFŘ Uniform Annual Rates** (official roční jednotné kurzy) and **ČNB Daily Exchange Rates**.
  - Downloadable CSV tax report structured directly for tax advisors and statutory filing.

---

### 2. ⚡ Smart DCA & Cashflow Rebalancer („Kam poslat výplatu“)
- **Optimal Water-Filling Buy-Only Algorithm:**
  - Constrained mathematical optimization distributing monthly salary savings without selling any existing assets:
    $$\lambda_k = \frac{\sum V_j + C}{\sum w_j^*}, \quad a_i = \max\left(0, \lambda^* w_i^* - V_i\right)$$
  - **Zero tax events and zero reset of the 3-year Czech time-test clock (§ 4 ZDP).**
  - Overweight assets are allocated exactly 0 CZK; 100% of the deposit elevates the most underweight positions.
  - **Largest Remainder (Hare-Niemeyer)** cent rounding guarantees exact allocation down to the crown.
- **Predefined Allocation Presets:**
  - *80/20 Core & Satellite* (70% S&P 500, 15% All-World, 5% Gold/Commodities, 10% Cash).
  - *100% Passive Indexes* (80% S&P 500, 20% All-World ETF).
  - *Czech & Global Portfolio* (60% S&P 500, 20% Czech dividend equities such as ČEZ/Moneta, 10% Gold, 10% Cash).
- **Automated Broker Order Slips:**
  - Grouped by broker (**XTB**, **DEGIRO**, **IBKR**) with broker-specific execution rules (fractional shares for XTB/IBKR vs. whole-share integer rounding for DEGIRO).
  - One-click copyable order slips ready to execute in broker apps.

---

### 3. 🔥 FIRE Command Center & Rentier Simulator
- **Comprehensive Multi-Tier FIRE Matrix:**
  - Calculates capital targets and years to freedom for **Lean FIRE**, **Standard FIRE**, **Fat FIRE** (customizable buffer), and **Barista FIRE** (part-time active income offset).
  - Configurable Safe Withdrawal Rate (SWR, 3.5% – 4.0% p.a.).
- **Coast FIRE & Milestone Age:**
  - Determines the exact capital where ongoing monthly contributions can stop, allowing compound interest alone to fund retirement at the desired age.
- **Liquid Runway & Financial Cushion:**
  - Translates cash and liquid reserves into months of essential living expenses (Danger < 3M, Solid 3–6M, Excellent 6–12M, Bulletproof > 12M).
- **Post-FIRE Decumulation & SORR Stress Test:**
  - 30-to-40-year discrete retirement drawdown simulator accounting for annual inflation, dynamic lifestyle spending adjustments, and Sequence of Returns Risk (SORR) stress scenarios (e.g. -25% market crash in Year 1).
- **DIP (Dlouhodobý investiční produkt) Tax Accelerator:**
  - Quantifies tax deductions under Czech § 15a ZDP (up to 48 000 CZK/year contribution saving up to 7 200 CZK in DPFO) plus exempt employer contributions (up to 50 000 CZK/year).

---

### 4. 📈 Performance Hub & Closed Positions Tracker
- **Monthly Return Heatmap (MoM Performance Matrix):**
  - Year × Month grid visualizing performance using institutional **GIPS Modified Dietz**, correctly weighting intra-month capital injections and withdrawals.
  - Geometric chain-linking for precise annual YTD returns.
- **Closed Positions Tracker & 3-Year Time Test (§ 4 ZDP):**
  - Real trade extraction from broker statements (XTB closed trades and DEGIRO FIFO sell orders).
  - Identifies tax-exempt trades ($\ge 1096$ days) vs. taxable trades, win rate, profit factor, average holding duration, and 15% tax savings.
- **Drawdown & Underwater Recovery Tracker:**
  - Measures distance from All-Time High (ATH), maximum historical drawdown, and time spent underwater.
- **Fee Leakage Audit:**
  - Quantifies broker commissions, hidden FX conversion drag, and compounds the 20-year opportunity cost ($FV \approx 4.66 \times \text{Fees}$ at 8% p.a.).

---

### 5. 💰 Personal Budget, Cashflow & Multi-Horizon Wealth Projection
- **Monthly Cashflow & Payday Calendar:**
  - Track salary, living expenses, and net investable monthly capacity.
  - Dynamic countdown to next payday.
- **Career Salary Escalator:**
  - Models annual wage indexation (e.g., +3% to +10% p.a.) compounding over 10 to 30 years.
- **2-Bucket Asset Simulation with Emergency Cushion Cap:**
  - Separates wealth into **Equities (ETFs/Stocks)** and **Cash/Savings Accounts**.
  - Enforces an emergency cushion cap (e.g., 500 000 CZK) with automatic spillover of surplus monthly savings into equity investments.
- **Confidence Volatility Bands:**
  - Visual dispersion cone (default $\pm 5\%$ p.a.) illustrating upside and downside probability ranges over 5 to 30 years.
  - Custom native SVG rendering with zero-dependency responsive crosshairs and tooltips.

---

### 6. 🌐 Multi-Broker Statement Parsing & Clustering
- **Native Statement Support:**
  - **XTB**: Multi-currency XLSX statements (CZK, USD, EUR accounts with closed positions and cash operations).
  - **DEGIRO**: Transactions XLSX and Account CSV with FIFO lot tracking.
  - **Interactive Brokers (IBKR)**: MTM Activity statements with fractional share support.
  - **Portu**: PDF statements (server-side parsing) and CSV transaction exports.
- **Smart Instrument Clustering:**
  - Automatically merges identical/equivalent assets across brokers and currencies into single macro-clusters (e.g., combining `SXR8.DE`, `VUAA.UK`, and `CSPX.UK` into S&P 500 Core).

---

### 7. 🎨 Lean UI & Control Center
- **Main Navigation Bar:** Compact layout featuring primary tabs (`Přehled`, `Pozice`, `Rozpočet`, `Dividendy`, `Predikce`) plus an expanding **`Nástroje ▾`** dropdown grouping analytical tools (`Vizuální rozpad`, `Klastry & Pravidla`).
- **Ovládací centrum (Tools Drawer):** Full-height slide-over drawer mounted via React Portal with application navigation, profile switcher, live price refresh, and database management.
- **Privacy Mode (`P` hotkey):** Instantly blurs all monetary values across tables, cards, and charts for public browsing or presentations.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime & Server** | [Bun](https://bun.sh/) (high-speed HTTP server, live quotes, Frankfurter FX API, server-side PDF parsing) |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript 5.7](https://www.typescriptlang.org/), [Vite 6](https://vitejs.dev/) |
| **Styling & Components** | [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **Data Visualizations** | Custom Native Zero-Dependency SVG Engine + [Recharts](https://recharts.org/) |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) with localStorage persistence |
| **Client Storage** | [Dexie.js](https://dexie.org/) (IndexedDB) with memory compaction |
| **Auth & Server Storage**| [jose](https://github.com/panva/jose) (JWT Access/Refresh tokens) + In-Memory / [Redis](https://ioredis.readthedocs.io/) |
| **Testing** | [Vitest](https://vitest.dev/) & Bun Test (108 unit & integration tests) |

---

## 📦 Getting Started

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.2+ recommended)

### 2. Installation
```bash
git clone https://github.com/xburian/portfolio-tracker.git
cd portfolio-tracker
bun install
```

### 3. Environment Configuration (Optional)
```bash
cp .env.example .env
```

### 4. Running the Development Server
```bash
# Starts the full stack (Vite client with HMR + Bun API backend)
bun run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Testing & Verification

The project enforces strict type-safety and 100% test coverage of all mathematical, algorithmic, and tax rules:

```bash
# 1. Run all unit and integration tests (108 tests)
bun test

# 2. Strict TypeScript typecheck (zero warnings/errors)
bun run typecheck

# 3. Production Vite build
bun run build

# 4. Run production server
NODE_ENV=production bun server/index.ts
```

---

## 🔒 Privacy & Data Security

- **Client-Side First:** All broker files, statements, transactions, and personal budget calculations reside locally within your browser's IndexedDB.
- **Zero External Tracking:** Financial calculations run client-side. The local Bun proxy is used strictly for Yahoo Finance market prices and central bank exchange rates.
- **Strict `.gitignore`:** All personal statements (`*.xlsx`, `*.csv`, `*.pdf`, `sample_data/`) are strictly ignored from source control.
- **Privacy Mode:** Press `P` at any time to mask all monetary values across the user interface.

---

## 📄 License

MIT © [Lukáš Burian](https://github.com/xburian)
