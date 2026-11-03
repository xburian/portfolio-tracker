import { Account, BrokerId, CurrencyCode, Holding, PositionLot } from '@/types/portfolio';
import {
  AnnualTaxReport,
  EtfSubstituteSuggestion,
  TaxHarvestSimulationItem,
  TaxHarvestSimulationResult,
  TaxLossCandidate,
} from '@/types/tax';
import { CurrencyService } from './currencyService';

export class TaxLossHarvestingService {
  /**
   * Common ETF Substitutes for Czech Investors
   * Preserves market exposure while using distinct ISIN/emitent to comply with § 8 odst. 4 Daňový řád (Abuse of rights).
   */
  public static readonly ETF_SUBSTITUTES: Record<string, EtfSubstituteSuggestion> = {
    'SXR8': {
      ticker: 'VUAA.UK',
      name: 'Vanguard S&P 500 UCITS ETF (Acc)',
      isin: 'IE00BFMXXD54',
      description: 'Přímý ekvivalent k SXR8 s TER 0.07 %, kótovaný na LSE v USD / BVME v EUR.',
    },
    'SXR8.DE': {
      ticker: 'VUAA.UK',
      name: 'Vanguard S&P 500 UCITS ETF (Acc)',
      isin: 'IE00BFMXXD54',
      description: 'Přímý ekvivalent k SXR8 s TER 0.07 %, kótovaný na LSE v USD / BVME v EUR.',
    },
    'VUAA': {
      ticker: 'SXR8.DE',
      name: 'iShares Core S&P 500 UCITS ETF (Acc)',
      isin: 'IE00B5BMR087',
      description: 'Největší evropské ETF na S&P 500 (AUM > 80 mld. EUR), TER 0.07 %.',
    },
    'VUAA.UK': {
      ticker: 'SXR8.DE',
      name: 'iShares Core S&P 500 UCITS ETF (Acc)',
      isin: 'IE00B5BMR087',
      description: 'Největší evropské ETF na S&P 500 (AUM > 80 mld. EUR), TER 0.07 %.',
    },
    'VWCE': {
      ticker: 'ISAC.L',
      name: 'iShares MSCI ACWI UCITS ETF (Acc)',
      isin: 'IE00B6R52259',
      description: 'Celosvětové All-World ETF (developed + emerging markets), TER 0.20 %.',
    },
    'VWCE.DE': {
      ticker: 'ISAC.L',
      name: 'iShares MSCI ACWI UCITS ETF (Acc)',
      isin: 'IE00B6R52259',
      description: 'Celosvětové All-World ETF (developed + emerging markets), TER 0.20 %.',
    },
    'SWDA': {
      ticker: 'VWCE.DE',
      name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
      isin: 'IE00BK5BQT80',
      description: 'Globální diverzifikace přes 3 600 akcií po celém světě, TER 0.22 %.',
    },
    'SWDA.L': {
      ticker: 'VWCE.DE',
      name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
      isin: 'IE00BK5BQT80',
      description: 'Globální diverzifikace přes 3 600 akcií po celém světě, TER 0.22 %.',
    },
    'NDX1': {
      ticker: 'EQAC.DE',
      name: 'Invesco Nasdaq-100 ESG UCITS ETF',
      isin: 'IE00BMFKQC30',
      description: 'Alternativa k technologickému indexu Nasdaq-100 s TER 0.25 %.',
    },
    'EGLN.UK': {
      ticker: 'SGLD.L',
      name: 'Invesco Physical Gold ETC',
      isin: 'IE00B579F325',
      description: 'Fyzicky kryté zlato v trezorech v Londýně, TER 0.12 %.',
    },
  };

  /**
   * Resolves recommended ETF substitute for a ticker
   */
  public static getSubstitute(ticker: string, isin?: string): EtfSubstituteSuggestion | undefined {
    const norm = (ticker || '').toUpperCase().trim();
    if (this.ETF_SUBSTITUTES[norm]) {
      return this.ETF_SUBSTITUTES[norm];
    }
    const cleanNorm = norm.split('.')[0];
    if (this.ETF_SUBSTITUTES[cleanNorm]) {
      return this.ETF_SUBSTITUTES[cleanNorm];
    }

    // Default guidance for single stocks or unmapped ETF
    return {
      ticker: `${cleanNorm} (Alt)`,
      name: `Sektorová alternativa nebo vyčkání na reinvestici`,
      isin: isin || 'N/A',
      description:
        'V ČR se doporučuje vyčkat minimálně několik obchodních dní před zpětným nákupem stejného titulu nebo kapitál dočasně alokovat do oborového indexu pro vyloučení rizika zneužití práva (§ 8 odst. 4 Daňového řádu).',
    };
  }

  /**
   * Scans portfolio lots and identifies all candidate lots for Tax-Loss Harvesting.
   *
   * CRITICAL CZECH TAX LAW INVARIANTS:
   * 1. Lots držené >= 1096 dní (3 roky) jsou OSVOBOZENÉ (§ 4(1)(w) ZDP).
   *    Ztráta z takového lotu je DAŇOVĚ NEUZNATELNÁ (§ 5(2) a § 10(4) ZDP) - musí být vyloučena!
   * 2. Pouze otevřené loty v nerealizované ztrátě v CZK (včetně FX efektu).
   */
  public static findCandidates(
    holdings: Holding[],
    lots: PositionLot[],
    accounts: Account[],
    displayCurrency: CurrencyCode = 'CZK',
    referenceDate: Date = new Date()
  ): TaxLossCandidate[] {
    const candidates: TaxLossCandidate[] = [];
    const refTime = referenceDate.getTime();

    for (const lot of lots) {
      if (lot.quantity <= 0.000001) continue;

      const openTime = new Date(lot.openDateUtc).getTime();
      if (isNaN(openTime)) continue;

      const holdingDays = Math.max(0, Math.floor((refTime - openTime) / (1000 * 86400)));

      // 1. ZÁKONNÁ PODMÍNKA: Doba držení MUSÍ být striktně méně než 3 roky (1096 dní)
      if (holdingDays >= 1096) {
        continue;
      }

      const holding = holdings.find((h) => h.id === lot.holdingId);
      if (!holding || holding.assetClass === 'CASH') continue;

      const matchedAccount = accounts.find((a) => a.id === lot.accountId);
      const accountName = matchedAccount?.name || `${holding.brokerId} ${lot.accountId}`.trim();

      const fxRate = CurrencyService.getRate(lot.instrumentCurrency, 'CZK');
      const curPriceNative = holding.currentPrice;
      const openPriceNative = lot.openPrice;

      const costBasisCZK = lot.quantity * openPriceNative * fxRate;
      const currentMarketValueCZK = lot.quantity * curPriceNative * fxRate;
      const unrealizedLossCZK = currentMarketValueCZK - costBasisCZK;

      // 2. PODMÍNKA: Pozice musí být ve ztrátě (alespoň 10 Kč pro zamezení zaokrouhlovacího šumu)
      if (unrealizedLossCZK < -10) {
        const absLoss = Math.abs(unrealizedLossCZK);
        const lossDensity = absLoss / Math.max(1, currentMarketValueCZK);
        const potentialTaxSavingsCZK = Math.round(absLoss * 0.15);
        const daysToTimeTest = Math.max(0, 1096 - holdingDays);

        candidates.push({
          lotId: lot.id,
          holdingId: holding.id,
          accountId: lot.accountId,
          accountName,
          brokerId: holding.brokerId,
          symbol: holding.rawTicker || holding.normalizedTicker,
          name: holding.name,
          isin: holding.isin,
          openDateUtc: lot.openDateUtc,
          holdingDays,
          daysToTimeTest,
          quantity: lot.quantity,
          openPriceNative,
          currentPriceNative: curPriceNative,
          instrumentCurrency: lot.instrumentCurrency,
          costBasisCZK: Math.round(costBasisCZK),
          currentMarketValueCZK: Math.round(currentMarketValueCZK),
          unrealizedLossCZK: Math.round(unrealizedLossCZK),
          potentialTaxSavingsCZK,
          lossDensity: Math.round(lossDensity * 1000) / 1000,
          suggestedSubstitute: this.getSubstitute(holding.normalizedTicker || holding.rawTicker, holding.isin),
        });
      }
    }

    // Sort by Loss Density descending (quant-optimal: maximum loss per crown of gross proceeds)
    return candidates.sort((a, b) => b.lossDensity - a.lossDensity);
  }

  /**
   * Simulates the financial and tax impact of harvesting selected loss candidates.
   */
  public static simulateHarvest(
    currentReport: AnnualTaxReport,
    selections: Array<{ candidate: TaxLossCandidate; harvestQuantity: number }>
  ): TaxHarvestSimulationResult {
    const preNonExemptGross = currentReport.securities.nonExemptGrossSalesCZK;
    const preNetResult = currentReport.securities.netSecuritiesResultCZK;
    const preTaxBase = currentReport.securities.taxBaseSecuritiesCZK;
    const preTaxDue = currentReport.securities.estimatedTaxSecuritiesCZK;
    const isPreUnder100k = currentReport.securities.isUnder100kLimit;

    let totalLossHarvestedCZK = 0;
    let totalProceedsGeneratedCZK = 0;
    const simulationItems: TaxHarvestSimulationItem[] = [];

    for (const sel of selections) {
      if (sel.harvestQuantity <= 0.000001) continue;

      const fraction = Math.min(1.0, sel.harvestQuantity / sel.candidate.quantity);
      const harvestLoss = Math.round(Math.abs(sel.candidate.unrealizedLossCZK) * fraction);
      const harvestProceeds = Math.round(sel.candidate.currentMarketValueCZK * fraction);

      totalLossHarvestedCZK += harvestLoss;
      totalProceedsGeneratedCZK += harvestProceeds;

      simulationItems.push({
        candidate: sel.candidate,
        harvestQuantity: sel.harvestQuantity,
        harvestLossCZK: harvestLoss,
        harvestProceedsCZK: harvestProceeds,
      });
    }

    const newNonExemptGross = preNonExemptGross + totalProceedsGeneratedCZK;
    const breaks100kCliff = isPreUnder100k && newNonExemptGross > 100_000;
    const newSec10NetResultCZK = preNetResult - totalLossHarvestedCZK;

    let newSec10TaxBaseCZK = 0;
    let newSec10TaxDueCZK = 0;

    if (breaks100kCliff) {
      // DANGER: Lost 100k exemption! Previous exempt gain now becomes taxable!
      newSec10TaxBaseCZK = Math.max(0, newSec10NetResultCZK);
      newSec10TaxDueCZK = Math.round(newSec10TaxBaseCZK * 0.15);
    } else if (newNonExemptGross <= 100_000) {
      // Still fully exempt under 100 000 CZK gross revenue limit
      newSec10TaxBaseCZK = 0;
      newSec10TaxDueCZK = 0;
    } else {
      // Normal taxable calculation
      newSec10TaxBaseCZK = Math.max(0, newSec10NetResultCZK);
      newSec10TaxDueCZK = Math.round(newSec10TaxBaseCZK * 0.15);
    }

    // Net cash saved on tax
    const netCashSavedCZK = breaks100kCliff
      ? preTaxDue - newSec10TaxDueCZK // Likely negative or 0 due to cliff
      : Math.max(0, preTaxDue - newSec10TaxDueCZK);

    // Over-harvesting check: tax base is 0, yet more losses were realized than needed
    const isOverHarvested = totalLossHarvestedCZK > Math.max(0, preNetResult) && totalLossHarvestedCZK > 0;
    const overHarvestAmountCZK = isOverHarvested
      ? Math.round(totalLossHarvestedCZK - Math.max(0, preNetResult))
      : 0;

    return {
      preOptimization: {
        sec10NetResultCZK: preNetResult,
        sec10TaxBaseCZK: preTaxBase,
        sec10TaxDueCZK: preTaxDue,
        nonExemptGrossSalesCZK: preNonExemptGross,
        isUnder100kLimit: isPreUnder100k,
      },
      postOptimization: {
        totalLossHarvestedCZK,
        totalProceedsGeneratedCZK,
        newNonExemptGrossSalesCZK: newNonExemptGross,
        newSec10NetResultCZK,
        newSec10TaxBaseCZK,
        newSec10TaxDueCZK,
        netCashSavedCZK,
        isOverHarvested,
        overHarvestAmountCZK,
        breaks100kCliff,
      },
      simulationItems,
    };
  }

  /**
   * Scans for profitable lots nearing the 3-year time test exemption.
   * Warns the user that holding for X more days will unlock 100% tax exemption.
   */
  public static getUpcomingExemptLots(
    holdings: Holding[],
    lots: PositionLot[],
    referenceDate: Date = new Date(),
    thresholdDays: number = 60
  ): Array<{
    lotId: string;
    ticker: string;
    name: string;
    quantity: number;
    daysRemaining: number;
    unrealizedGainCZK: number;
    taxProtectionValueCZK: number;
  }> {
    const upcoming: Array<{
      lotId: string;
      ticker: string;
      name: string;
      quantity: number;
      daysRemaining: number;
      unrealizedGainCZK: number;
      taxProtectionValueCZK: number;
    }> = [];

    const refTime = referenceDate.getTime();

    for (const lot of lots) {
      if (lot.quantity <= 0.000001) continue;
      const openTime = new Date(lot.openDateUtc).getTime();
      if (isNaN(openTime)) continue;

      const holdingDays = Math.max(0, Math.floor((refTime - openTime) / (1000 * 86400)));
      const daysRemaining = 1096 - holdingDays;

      if (daysRemaining > 0 && daysRemaining <= thresholdDays) {
        const holding = holdings.find((h) => h.id === lot.holdingId);
        if (!holding || holding.assetClass === 'CASH') continue;

        const fxRate = CurrencyService.getRate(lot.instrumentCurrency, 'CZK');
        const costCZK = lot.quantity * lot.openPrice * fxRate;
        const currentCZK = lot.quantity * holding.currentPrice * fxRate;
        const gainCZK = currentCZK - costCZK;

        if (gainCZK > 1000) {
          upcoming.push({
            lotId: lot.id,
            ticker: holding.rawTicker || holding.normalizedTicker,
            name: holding.name,
            quantity: lot.quantity,
            daysRemaining,
            unrealizedGainCZK: Math.round(gainCZK),
            taxProtectionValueCZK: Math.round(gainCZK * 0.15),
          });
        }
      }
    }

    return upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }
}
