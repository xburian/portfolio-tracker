# 📈 Portfolio Tracker

[![CI](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml)

A comprehensive, modern web application for tracking, analyzing, rebalancing, and tax-optimizing investment portfolios across multiple brokers (**XTB**, **DEGIRO**, **Interactive Brokers**, **Portu**, bank accounts, and uninvested cash).

---

## 🚀 Key Features

- **Multi-Broker Integration**:
  - Native parser support for **XTB** (XLSX account exports for CZK, USD, EUR), **DEGIRO** (XLSX and CSV transaction exports), **Interactive Brokers** (MTM CSV statements), and **Portu** (PDF statements and CSV exports, including Czech DIP retirement accounts).
  - Accurate purchase and sale lot matching using the **FIFO (First-In, First-Out)** method with support for fractional shares (up to 6 decimal places).
- **Czech 3-Year Time-Test Tax Exemption (§ 4(1)(w) ZDP)**:
  - Automatically consolidates identical securities across different broker accounts (e.g., Berkshire Hathaway or S&P 500 held simultaneously on XTB and DEGIRO).
  - Computes tax-exempt vs. locked shares, exempt market value, estimated 15% tax savings, and an exact day countdown until future lots unlock.
- **Performance Metrics (GIPS Modified Dietz)**:
  - Measures true portfolio returns across multiple horizons: **YTD (Year-to-Date)**, **1 Year (1Y)**, **3 Years (3Y)**, **5 Years (5Y)**, and **All-Time**.
  - Accounts for ongoing cash inflows and lot timing (Money-Weighted Return), calculates annualized compound returns (**CAGR p.a.**), and computes benchmark excess return (**Alpha**) against **S&P 500** and **FTSE All-World**.
- **Free Cash Management & Multi-Currency**:
  - Full native support for **CZK**, **USD**, **EUR**, and **GBP** with automatic conversion using live central bank exchange rates (CNB / ECB via Frankfurter API).
  - Track uninvested broker cash alongside custom bank, savings, or reserve accounts.
- **Visual Allocation & Analytics**:
  - Vector-sharp, interactive donut/pie allocation chart with multi-dimensional groupings: **Ticker / Position**, **Strategy Clusters**, **Asset Class**, **Currency**, and **Broker**.
  - Interactive drill-downs, weight progress bars, and instant table filtering.
- **Smart Clustering & NLP Tagging**:
  - Automatically classifies and clusters equivalent instruments (e.g., mapping `SXR8.DE` and `VUAA.UK` to the core S&P 500 benchmark).
- **Enterprise Authentication & Dual Storage**:
  - **JWT Access Tokens (15 min)** with **Rotating Refresh Tokens (7 days)** stored in secure `HttpOnly; SameSite=Lax` cookies with token reuse detection.
  - **Dual storage abstraction**: Zero-config, high-performance **In-Memory storage** for local development, and persistent **Redis DB** storage for production deployment.
- **Multi-User Profiles & Client Database**:
  - Manage multiple independent portfolios or family members in one application.
  - Fast client-side persistence powered by **IndexedDB (Dexie.js)** with built-in database compaction and cleanup tools.
- **Privacy Mode**:
  - Global hotkey toggle (`P`) to instantly blur all account numbers, balances, and sensitive monetary amounts on screen.

---

## 🛠️ Tech Stack

- **Runtime & Server**: [Bun](https://bun.sh/) (high-speed HTTP server, live Yahoo Finance quotes, Frankfurter FX API, server-side PDF parsing)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Visualizations**: [Recharts](https://recharts.org/)
- **State Management & Database**: [Zustand](https://zustand.docs.pmnd.rs/), [Dexie.js](https://dexie.org/) (IndexedDB)
- **Authentication & Security**: [jose](https://github.com/panva/jose) (JWT), [ioredis](https://github.com/ioredis/ioredis)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 📦 Getting Started

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.2+ recommended)

### 2. Clone and Install
```bash
git clone https://github.com/xburian/portfolio-tracker.git
cd portfolio-tracker
bun install
```

### 3. Environment Configuration
Create a `.env` file from the provided example (optional; sensible defaults are used for local development):
```bash
cp .env.example .env
```

### 4. Running the Development Server
```bash
# Starts the full stack (Vite client with HMR + Bun API server)
bun run dev
```
Open your browser at `http://localhost:3000` (reverse-proxied to Vite dev server at `http://localhost:5173`).

---

## 🧪 Testing & Validation

The codebase includes an extensive suite of automated unit tests covering FIFO lot matching, KKT water-filling rebalancing algorithms, broker statement parsers, the Czech 3-year time test (§ 4 ZDP), GIPS performance calculations, and JWT token rotation:

```bash
# Run all unit tests
bun test

# Run TypeScript typecheck
bun run typecheck

# Build for production
bun run build

# Start production server
NODE_ENV=production bun server/index.ts
```

---

## 🔒 Privacy & Data Security

- **Zero Data Leakage**: The repository strictly ignores all real broker statements, transactions, exports, and private documents (`sample_data/`, `degiro_transactions.*`, `*.csv`, `*.xlsx`, `*.pdf`, `.env`) via `.gitignore`.
- **Client-Side First**: Your actual portfolio data is stored locally in your browser's IndexedDB.
- **Privacy Mode**: Press `P` anytime to hide sensitive numbers during presentations or screenshots.
