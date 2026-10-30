# 📈 Portfolio Tracker

[![CI](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/xburian/portfolio-tracker/actions/workflows/ci.yml)

Komplexní moderní webová aplikace pro sledování, analýzu, rebalancování a daňovou optimalizaci investičního portfolia napříč více brokery (XTB, Degiro, Interactive Brokers, Portu, bankovní účty a volná hotovost).

---

## 🚀 Klíčové funkce

- **Multi-Broker Integrace**:
  - Podpora pro **XTB** (XLSX výpisy účtů CZK, USD, EUR), **DEGIRO** (XLSX a CSV exporty transakcí), **Interactive Brokers** (MTM CSV výpisy), **Portu** (PDF i CSV výpisy včetně DIP).
  - Přesné párování nákupních a prodejních lotů metodou **FIFO** a podpora frakčních akcií (až na 6 desetinných míst).
- **Český 3letý časový test (§ 4 odst. 1 písm. w) ZDP)**:
  - Automatické seskupení stejných instrumentů napříč brokery (např. Berkshire Hathaway nebo S&P 500 držené na XTB i Degiro dohromady).
  - Výpočet počtu osvobozených kusů, tržní hodnoty, odhadu ušetřené 15% daně a odpočtu dní do odemčení dalších pozic.
- **Výkonnostní metriky (GIPS Modified Dietz)**:
  - Měření zhodnocení v horizontech **YTD (od začátku roku)**, **1Y**, **3Y**, **5Y** a **All-Time**.
  - Zohlednění průběžných vkladů kapitálu, výpočet anualizovaného výnosu (CAGR p.a.) a nadvýnosu (*Alpha*) vůči **S&P 500** a **FTSE All-World**.
- **Správa volné hotovosti & Multi-Currency**:
  - Plná podpora měn CZK, USD, EUR a GBP s automatickým přepočtem podle kurzů ČNB / ECB.
  - Možnost evidovat volnou hotovost na brokerských účtech i přidávat vlastní bankovní a hotovostní rezervy.
- **Vizuální rozpad & Analytika alokace**:
  - Vektorově ostrý interaktivní prstencový graf se zobrazením podle **tickeru / pozice**, **klastrů / strategií**, **třídy aktiv**, **měny** a **brokera**.
- **Klastry a chytrá konsolidace**:
  - Automatické shlukování ekvivalentních ETF (např. SXR8.DE a VUAA.UK pod jeden S&P 500 klastr).
- **Autentizace & Duální úložiště**:
  - JWT Access Tokeny (15m) + rotace Refresh Tokenů (7d) v zabezpečených HttpOnly cookies s ochranou proti zneužití tokenů.
  - Duální storage: bezkonfigurační **lokální In-Memory** pro vývoj / **persistentní Redis** pro produkční nasazení.
- **Multi-User & Klientská databáze**:
  - Možnost spravovat více oddělených uživatelských profilů v jedné aplikaci.
  - Lokální rychlá perzistence v prohlížeči pomocí **IndexedDB (Dexie.js)** s nástrojem na čištění a kompaktaci dat.

---

## 🛠️ Použité technologie

- **Runtime & Backend**: [Bun](https://bun.sh/) (vysokorychlostní HTTP server, live Yahoo Finance quotes, Frankfurter FX API, PDF parsing)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Vizualizace**: [Recharts](https://recharts.org/)
- **State Management & Databáze**: [Zustand](https://zustand.docs.pmnd.rs/), [Dexie.js](https://dexie.org/) (IndexedDB)
- **Autentizace & Cache**: [jose](https://github.com/panva/jose) (JWT), [ioredis](https://github.com/ioredis/ioredis)
- **Testování**: [Vitest](https://vitest.dev/)

---

## 📦 Instalace a spuštění

### 1. Požadavky
- Nainstalovaný [Bun](https://bun.sh/) (doporučeno v1.2+)

### 2. Klonování a instalace závislostí
```bash
git clone https://github.com/xburian/portfolio-tracker.git
cd portfolio-tracker
bun install
```

### 3. Konfigurace prostředí
Vytvořte soubor `.env` (volitelně, pro lokální vývoj fungují výchozí hodnoty):
```bash
cp .env.example .env
```

### 4. Spuštění vývojového serveru
```bash
# Spuštění kompletního stacku (Vite client + Bun API server)
bun run dev
```
Aplikace běží na: `http://localhost:3000` (s automatickým HMR proxy na `http://localhost:5173`).

---

## 🧪 Testy a kontrola typů

Projekt má rozsáhlou sadu unit testů pokrývajících FIFO lot párování, rebalancovací KKT algoritmy, parser výpisů, časový test § 4 ZDP i JWT rotaci:

```bash
# Spuštění všech testů
bun test

# Kontrola TypeScript typů
bun run typecheck

# Produkční build
bun run build
```

---

## 🔒 Bezpečnost a ochrana soukromí
- Aplikace neobsahuje žádné hardcodované osobní údaje ani reálné výpisy z účtů (všechny citlivé soubory jsou ignorovány v `.gitignore`).
- K dispozici je **Privacy Mode** (klávesová zkratka `P`), který okamžitě rozostří všechny citlivé finanční částky na obrazovce.
