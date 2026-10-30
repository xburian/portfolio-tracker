import { Account, CurrencyCode, PositionLot, ValuationDetail } from '@/types/portfolio';
import { CurrencyService } from './currencyService';
import { MarketPriceService } from './marketPriceService';

export interface TimeTestLotDetail {
  ticketId: string;
  accountId: string;
  accountName: string;
  brokerId: string;
  openDateUtc: string;
  exemptDate: string;
  isExempt: boolean;
  daysToUnlock: number;
  quantity: number;
  openPrice: number;
  instrumentCurrency: CurrencyCode;
  currentPrice: number;
  marketValueTarget: number;
  costBasisTarget: number;
  gainTarget: number;
  taxSavedTarget: number;
}

export interface GroupedTimeTestStatus {
  canonicalTicker: string;
  displaySymbol: string;
  name: string;
  isin?: string;
  assetClass: string;
  instrumentCurrency: CurrencyCode;

  brokers: Array<{
    brokerId: string;
    accountName: string;
    accountId: string;
    totalQuantity: number;
    exemptQuantity: number;
    lockedQuantity: number;
    exemptPercentage: number;
  }>;

  totalQuantity: number;
  exemptQuantity: number;
  lockedQuantity: number;
  exemptPercentage: number;

  totalMarketValueTarget: number;
  exemptMarketValueTarget: number;
  lockedMarketValueTarget: number;

  exemptCostBasisTarget: number;
  exemptUnrealizedGainTarget: number;
  estimatedTaxSavedTarget: number; // 15% česká daň z příjmů

  nextUnlockDate: string | null;
  daysToNextUnlock: number | null;
  nextUnlockQuantity: number | null;
  nextUnlockMarketValueTarget: number | null;

  lots: TimeTestLotDetail[];
}

export interface HoldingTimeTestStatus {
  holdingId: string;
  symbol: string;
  name: string;
  totalQuantity: number;
  exemptQuantity: number;
  lockedQuantity: number;
  exemptPercentage: number;

  totalMarketValueTarget: number;
  exemptMarketValueTarget: number;
  lockedMarketValueTarget: number;

  exemptCostBasisTarget: number;
  exemptUnrealizedGainTarget: number;
  estimatedTaxSavedTarget: number; // 15% česká daň z příjmů

  nextUnlockDate: string | null;
  daysToNextUnlock: number | null;
  nextUnlockQuantity: number | null;
  nextUnlockMarketValueTarget: number | null;
}

export interface PortfolioTimeTestSummary {
  targetCurrency: CurrencyCode;
  totalMarketValue: number;
  totalExemptMarketValue: number;
  totalLockedMarketValue: number;
  overallExemptPercentage: number;
  totalEstimatedTaxSaved: number;

  nextPortfolioUnlockDate: string | null;
  daysToNextPortfolioUnlock: number | null;
  nextPortfolioUnlockSymbol: string | null;
  nextPortfolioUnlockQuantity: number | null;

  holdings: HoldingTimeTestStatus[];
  groupedHoldings: GroupedTimeTestStatus[];
}

export class TaxTimeTestService {
  private static readonly TAX_RATE = 0.15; // 15 % česká daň z příjmů FO dle § 16 ZDP
  private static readonly TIME_TEST_YEARS = 3; // 3 roky dle § 4 odst. 1 písm. w) ZDP

  /**
   * Spočítá datum daňového osvobození přičtením přesně 3 let dle § 605 odst. 2 občanského zákoníku.
   */
  public static getExemptDate(buyDateIso: string): Date {
    const d = new Date(buyDateIso);
    d.setFullYear(d.getFullYear() + this.TIME_TEST_YEARS);
    return d;
  }

  /**
   * Ověří, zda je lot k referenčnímu datu již daňově osvobozen.
   */
  public static isLotExempt(buyDateIso: string, referenceDate: Date = new Date()): boolean {
    return referenceDate.getTime() >= this.getExemptDate(buyDateIso).getTime();
  }

  /**
   * Spočítá analýzu časového testu pro jednu pozici.
   */
  public static analyzeHolding(
    valuation: ValuationDetail,
    lots: PositionLot[],
    displayCurrency: CurrencyCode,
    referenceDate: Date = new Date()
  ): HoldingTimeTestStatus {
    const refTime = referenceDate.getTime();
    const holdingLots = lots.filter(l => l.holdingId === valuation.holding.id && l.quantity > 0);

    let totalQty = valuation.quantity;
    let exemptQty = 0;
    let exemptCostBasisTarget = 0;

    let minNextUnlockTime = Infinity;
    let nextUnlockQty = 0;

    const fxCurrent = CurrencyService.getRate(valuation.instrumentCurrency, displayCurrency);
    const curPriceTarget = valuation.currentPriceNative * fxCurrent;

    for (const lot of holdingLots) {
      const unlockDate = this.getExemptDate(lot.openDateUtc);
      const unlockTime = unlockDate.getTime();

      const lotFx = CurrencyService.getRate(lot.instrumentCurrency, displayCurrency);
      const lotCostTarget = lot.quantity * lot.openPrice * lotFx;

      if (refTime >= unlockTime) {
        exemptQty += lot.quantity;
        exemptCostBasisTarget += lotCostTarget;
      } else {
        if (unlockTime < minNextUnlockTime) {
          minNextUnlockTime = unlockTime;
          nextUnlockQty = lot.quantity;
        } else if (unlockTime === minNextUnlockTime) {
          nextUnlockQty += lot.quantity;
        }
      }
    }

    // Pokud nemáme jednotlivé nákupní tikety, posuzujeme celou pozici podle data importu
    if (holdingLots.length === 0 && totalQty > 0) {
      exemptQty = 0;
    }

    // Ošetření zaokrouhlení
    exemptQty = Math.min(totalQty, Math.max(0, exemptQty));
    const lockedQty = Math.max(0, totalQty - exemptQty);
    const exemptPercent = totalQty > 0 ? (exemptQty / totalQty) * 100 : 0;

    const exemptMvTarget = exemptQty * curPriceTarget;
    const lockedMvTarget = lockedQty * curPriceTarget;

    const exemptGainTarget = Math.max(0, exemptMvTarget - exemptCostBasisTarget);
    const taxSavedTarget = exemptGainTarget * this.TAX_RATE;

    const hasLocked = lockedQty > 0.0001 && minNextUnlockTime !== Infinity;
    const nextUnlockDate = hasLocked ? new Date(minNextUnlockTime).toISOString().slice(0, 10) : null;
    const daysToNext = hasLocked
      ? Math.max(0, Math.ceil((minNextUnlockTime - refTime) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      holdingId: valuation.holding.id,
      symbol: valuation.holding.rawTicker,
      name: valuation.holding.name,
      totalQuantity: +totalQty.toFixed(4),
      exemptQuantity: +exemptQty.toFixed(4),
      lockedQuantity: +lockedQty.toFixed(4),
      exemptPercentage: +exemptPercent.toFixed(1),

      totalMarketValueTarget: valuation.marketValueTarget,
      exemptMarketValueTarget: Math.round(exemptMvTarget),
      lockedMarketValueTarget: Math.round(lockedMvTarget),

      exemptCostBasisTarget: Math.round(exemptCostBasisTarget),
      exemptUnrealizedGainTarget: Math.round(exemptGainTarget),
      estimatedTaxSavedTarget: Math.round(taxSavedTarget),

      nextUnlockDate,
      daysToNextUnlock: daysToNext,
      nextUnlockQuantity: hasLocked ? +nextUnlockQty.toFixed(4) : null,
      nextUnlockMarketValueTarget: hasLocked ? Math.round(nextUnlockQty * curPriceTarget) : null,
    };
  }

  /**
   * Spočítá celkový souhrn 3letého časového testu pro celé portfolio.
   */
  public static calculatePortfolioSummary(
    valuations: ValuationDetail[],
    allLots: PositionLot[],
    displayCurrency: CurrencyCode,
    referenceDate: Date = new Date()
  ): PortfolioTimeTestSummary {
    const analyzed = valuations.map(v =>
      this.analyzeHolding(v, allLots, displayCurrency, referenceDate)
    );

    let totalMv = 0;
    let totalExemptMv = 0;
    let totalTaxSaved = 0;

    let minPortfolioUnlockTime = Infinity;
    let nextSymbol: string | null = null;
    let nextQuantity: number | null = null;

    for (const h of analyzed) {
      totalMv += h.totalMarketValueTarget;
      totalExemptMv += h.exemptMarketValueTarget;
      totalTaxSaved += h.estimatedTaxSavedTarget;

      if (h.daysToNextUnlock !== null && h.nextUnlockDate) {
        const t = new Date(h.nextUnlockDate).getTime();
        if (t < minPortfolioUnlockTime) {
          minPortfolioUnlockTime = t;
          nextSymbol = h.symbol;
          nextQuantity = h.nextUnlockQuantity;
        }
      }
    }

    const overallExemptPercent = totalMv > 0 ? (totalExemptMv / totalMv) * 100 : 0;
    const refTime = referenceDate.getTime();
    const hasNext = minPortfolioUnlockTime !== Infinity;

    return {
      targetCurrency: displayCurrency,
      totalMarketValue: Math.round(totalMv),
      totalExemptMarketValue: Math.round(totalExemptMv),
      totalLockedMarketValue: Math.round(totalMv - totalExemptMv),
      overallExemptPercentage: +overallExemptPercent.toFixed(1),
      totalEstimatedTaxSaved: Math.round(totalTaxSaved),

      nextPortfolioUnlockDate: hasNext ? new Date(minPortfolioUnlockTime).toISOString().slice(0, 10) : null,
      daysToNextPortfolioUnlock: hasNext
        ? Math.max(0, Math.ceil((minPortfolioUnlockTime - refTime) / (1000 * 60 * 60 * 24)))
        : null,
      nextPortfolioUnlockSymbol: nextSymbol,
      nextPortfolioUnlockQuantity: nextQuantity,

      holdings: analyzed,
      groupedHoldings: [],
    };
  }

  /**
   * Spočítá seskupený přehled časového testu napříč všemi brokery.
   * Cenné papíry stejného druhu a emitenta (např. Berkshire Hathaway, S&P 500, ASML)
   * jsou sloučeny do jedné položky s rozpadem po brokerech a lotech.
   */
  public static calculateGroupedSummary(
    valuations: ValuationDetail[],
    allLots: PositionLot[],
    accounts: Account[],
    displayCurrency: CurrencyCode,
    referenceDate: Date = new Date()
  ): PortfolioTimeTestSummary {
    const refTime = referenceDate.getTime();
    const securities = valuations.filter(v => v.holding.assetClass !== 'CASH');

    const accountMap = new Map<string, Account>();
    for (const a of accounts) {
      accountMap.set(a.id, a);
    }

    interface GroupAccumulator {
      canonicalTicker: string;
      displaySymbol: string;
      name: string;
      isin?: string;
      assetClass: string;
      instrumentCurrency: CurrencyCode;
      currentPriceNative: number;
      valuations: ValuationDetail[];
    }

    const groupsMap = new Map<string, GroupAccumulator>();

    for (const v of securities) {
      const canonical = v.holding.normalizedTicker || MarketPriceService.normalizeTicker(v.holding.rawTicker, v.holding.isin);
      if (!groupsMap.has(canonical)) {
        groupsMap.set(canonical, {
          canonicalTicker: canonical,
          displaySymbol: v.holding.rawTicker !== canonical ? `${canonical} (${v.holding.rawTicker})` : canonical,
          name: v.holding.name,
          isin: v.holding.isin,
          assetClass: v.holding.assetClass,
          instrumentCurrency: v.holding.instrumentCurrency,
          currentPriceNative: v.holding.currentPrice,
          valuations: [],
        });
      }
      groupsMap.get(canonical)!.valuations.push(v);
    }

    const groupedHoldings: GroupedTimeTestStatus[] = [];

    for (const [canonical, g] of groupsMap.entries()) {
      // Find all lots across all accounts for this canonical ticker
      const matchingLots = allLots.filter(l => {
        const parts = l.holdingId.split(':');
        const lotTicker = parts[parts.length - 1] || '';
        const lotCanonical = MarketPriceService.normalizeTicker(lotTicker);
        return lotCanonical === canonical || l.holdingId.endsWith(`:${canonical}`);
      });

      // Sort chronologically ascending (FIFO)
      matchingLots.sort((a, b) => new Date(a.openDateUtc).getTime() - new Date(b.openDateUtc).getTime());

      let totalQty = 0;
      let exemptQty = 0;
      let exemptCostBasisTarget = 0;
      let exemptGainTarget = 0;
      let exemptMvTarget = 0;
      let lockedMvTarget = 0;

      let minNextUnlockTime = Infinity;
      let nextUnlockQty = 0;

      const lotDetails: TimeTestLotDetail[] = [];
      const brokerStats = new Map<string, { brokerId: string; accountName: string; accountId: string; totalQuantity: number; exemptQuantity: number; lockedQuantity: number }>();

      const bestCurrentPriceNative = g.currentPriceNative || (g.valuations[0]?.currentPriceNative) || 1;
      const fxRate = CurrencyService.getRate(g.instrumentCurrency, displayCurrency);
      const curPriceTarget = bestCurrentPriceNative * fxRate;

      for (const l of matchingLots) {
        if (l.quantity <= 0) continue;
        totalQty += l.quantity;

        const unlockDate = this.getExemptDate(l.openDateUtc);
        const unlockTime = unlockDate.getTime();
        const isExempt = refTime >= unlockTime;
        const daysToUnlock = Math.max(0, Math.ceil((unlockTime - refTime) / (1000 * 60 * 60 * 24)));

        const lotFx = CurrencyService.getRate(l.instrumentCurrency, displayCurrency);
        const lotCostTarget = l.quantity * l.openPrice * lotFx;
        const lotMvTarget = l.quantity * curPriceTarget;
        const lotGainTarget = Math.max(0, lotMvTarget - lotCostTarget);
        const lotTaxSaved = isExempt ? lotGainTarget * this.TAX_RATE : 0;

        if (isExempt) {
          exemptQty += l.quantity;
          exemptCostBasisTarget += lotCostTarget;
          exemptMvTarget += lotMvTarget;
          exemptGainTarget += lotGainTarget;
        } else {
          lockedMvTarget += lotMvTarget;
          if (unlockTime < minNextUnlockTime) {
            minNextUnlockTime = unlockTime;
            nextUnlockQty = l.quantity;
          } else if (unlockTime === minNextUnlockTime) {
            nextUnlockQty += l.quantity;
          }
        }

        const acc = accountMap.get(l.accountId);
        const brokerId = acc ? acc.brokerId : (l.accountId.split(':')[1]?.split('-')[0]?.toUpperCase() || 'BROKER');
        const accountName = acc ? acc.name : l.accountId;

        if (!brokerStats.has(l.accountId)) {
          brokerStats.set(l.accountId, {
            brokerId,
            accountName,
            accountId: l.accountId,
            totalQuantity: 0,
            exemptQuantity: 0,
            lockedQuantity: 0,
          });
        }
        const bStat = brokerStats.get(l.accountId)!;
        bStat.totalQuantity += l.quantity;
        if (isExempt) {
          bStat.exemptQuantity += l.quantity;
        } else {
          bStat.lockedQuantity += l.quantity;
        }

        lotDetails.push({
          ticketId: l.ticketId,
          accountId: l.accountId,
          accountName,
          brokerId,
          openDateUtc: l.openDateUtc,
          exemptDate: unlockDate.toISOString().slice(0, 10),
          isExempt,
          daysToUnlock,
          quantity: l.quantity,
          openPrice: l.openPrice,
          instrumentCurrency: l.instrumentCurrency,
          currentPrice: bestCurrentPriceNative,
          marketValueTarget: Math.round(lotMvTarget),
          costBasisTarget: Math.round(lotCostTarget),
          gainTarget: Math.round(lotGainTarget),
          taxSavedTarget: Math.round(lotTaxSaved),
        });
      }

      // If no matching lots were parsed, fall back to valuation sums
      if (matchingLots.length === 0) {
        totalQty = g.valuations.reduce((sum, v) => sum + v.quantity, 0);
        lockedMvTarget = g.valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
      }

      const totalMarketValueTarget = Math.round(exemptMvTarget + lockedMvTarget);
      const lockedQuantity = Math.max(0, totalQty - exemptQty);
      const exemptPercentage = totalQty > 0 ? (exemptQty / totalQty) * 100 : 0;
      const estimatedTaxSavedTarget = Math.round(exemptGainTarget * this.TAX_RATE);

      const hasLocked = lockedQuantity > 0.0001 && minNextUnlockTime !== Infinity;
      const nextUnlockDate = hasLocked ? new Date(minNextUnlockTime).toISOString().slice(0, 10) : null;
      const daysToNextUnlock = hasLocked
        ? Math.max(0, Math.ceil((minNextUnlockTime - refTime) / (1000 * 60 * 60 * 24)))
        : null;

      const brokers = Array.from(brokerStats.values()).map(b => ({
        ...b,
        totalQuantity: +b.totalQuantity.toFixed(4),
        exemptQuantity: +b.exemptQuantity.toFixed(4),
        lockedQuantity: +b.lockedQuantity.toFixed(4),
        exemptPercentage: b.totalQuantity > 0 ? +( (b.exemptQuantity / b.totalQuantity) * 100 ).toFixed(1) : 0,
      }));

      groupedHoldings.push({
        canonicalTicker: canonical,
        displaySymbol: g.displaySymbol,
        name: g.name,
        isin: g.isin,
        assetClass: g.assetClass,
        instrumentCurrency: g.instrumentCurrency,
        brokers,
        totalQuantity: +totalQty.toFixed(4),
        exemptQuantity: +exemptQty.toFixed(4),
        lockedQuantity: +lockedQuantity.toFixed(4),
        exemptPercentage: +exemptPercentage.toFixed(1),
        totalMarketValueTarget,
        exemptMarketValueTarget: Math.round(exemptMvTarget),
        lockedMarketValueTarget: Math.round(lockedMvTarget),
        exemptCostBasisTarget: Math.round(exemptCostBasisTarget),
        exemptUnrealizedGainTarget: Math.round(exemptGainTarget),
        estimatedTaxSavedTarget,
        nextUnlockDate,
        daysToNextUnlock,
        nextUnlockQuantity: hasLocked ? +nextUnlockQty.toFixed(4) : null,
        nextUnlockMarketValueTarget: hasLocked ? Math.round(nextUnlockQty * curPriceTarget) : null,
        lots: lotDetails,
      });
    }

    // Sort grouped holdings by total market value descending
    groupedHoldings.sort((a, b) => b.totalMarketValueTarget - a.totalMarketValueTarget);

    // Flat holdings (per account)
    const flatHoldings = securities.map(v =>
      this.analyzeHolding(v, allLots, displayCurrency, referenceDate)
    );

    let totalMv = 0;
    let totalExemptMv = 0;
    let totalTaxSaved = 0;
    let minPortfolioUnlockTime = Infinity;
    let nextSymbol: string | null = null;
    let nextQuantity: number | null = null;

    for (const h of groupedHoldings) {
      totalMv += h.totalMarketValueTarget;
      totalExemptMv += h.exemptMarketValueTarget;
      totalTaxSaved += h.estimatedTaxSavedTarget;

      if (h.daysToNextUnlock !== null && h.nextUnlockDate) {
        const t = new Date(h.nextUnlockDate).getTime();
        if (t < minPortfolioUnlockTime) {
          minPortfolioUnlockTime = t;
          nextSymbol = h.canonicalTicker;
          nextQuantity = h.nextUnlockQuantity;
        }
      }
    }

    const overallExemptPercent = totalMv > 0 ? (totalExemptMv / totalMv) * 100 : 0;
    const hasNext = minPortfolioUnlockTime !== Infinity;

    return {
      targetCurrency: displayCurrency,
      totalMarketValue: Math.round(totalMv),
      totalExemptMarketValue: Math.round(totalExemptMv),
      totalLockedMarketValue: Math.round(totalMv - totalExemptMv),
      overallExemptPercentage: +overallExemptPercent.toFixed(1),
      totalEstimatedTaxSaved: Math.round(totalTaxSaved),
      nextPortfolioUnlockDate: hasNext ? new Date(minPortfolioUnlockTime).toISOString().slice(0, 10) : null,
      daysToNextPortfolioUnlock: hasNext
        ? Math.max(0, Math.ceil((minPortfolioUnlockTime - refTime) / (1000 * 60 * 60 * 24)))
        : null,
      nextPortfolioUnlockSymbol: nextSymbol,
      nextPortfolioUnlockQuantity: nextQuantity,
      holdings: flatHoldings,
      groupedHoldings,
    };
  }
}
