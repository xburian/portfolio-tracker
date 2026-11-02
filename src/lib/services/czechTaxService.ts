import { ClosedPosition, CurrencyCode } from '@/types/portfolio';
import { DividendTransaction } from '@/types/dividend';
import {
  AnnualTaxReport,
  ExchangeRateMethod,
  TaxDividendCountrySummary,
  TaxDividendsSummary,
  TaxSecuritiesSaleItem,
  TaxSecuritiesSummary,
} from '@/types/tax';
import { CurrencyService } from './currencyService';

export class CzechTaxService {
  /**
   * Official Pokyn GFŘ-D Uniform Annual Exchange Rates (Jednotné kurzy GFŘ)
   */
  public static readonly GFR_UNIFORM_RATES: Record<number, Record<CurrencyCode, number>> = {
    2026: { CZK: 1.0, EUR: 25.10, USD: 23.30, GBP: 29.80 }, // Preliminary / Year-to-date
    2025: { CZK: 1.0, EUR: 24.85, USD: 22.95, GBP: 29.50 }, // Estimated
    2024: { CZK: 1.0, EUR: 25.11, USD: 23.27, GBP: 29.81 }, // Pokyn GFŘ-D-65
    2023: { CZK: 1.0, EUR: 24.00, USD: 22.14, GBP: 27.56 }, // Pokyn GFŘ-D-60
    2022: { CZK: 1.0, EUR: 24.56, USD: 23.41, GBP: 28.78 },
    2021: { CZK: 1.0, EUR: 25.64, USD: 21.68, GBP: 29.86 },
  };

  /**
   * Resolves exchange rate to CZK based on selected method and tax year
   */
  static getRateToCZK(currency: CurrencyCode, year: number, method: ExchangeRateMethod): number {
    if (currency === 'CZK') return 1.0;

    if (method === 'GFR_UNIFORM') {
      const yearRates = this.GFR_UNIFORM_RATES[year] || this.GFR_UNIFORM_RATES[2024];
      return yearRates[currency] || CurrencyService.getRate(currency, 'CZK');
    }

    // Default to CurrencyService live/cached daily rate
    return CurrencyService.getRate(currency, 'CZK');
  }

  /**
   * Calculates comprehensive Czech Tax Report (§ 4, § 8, § 10 ZDP)
   */
  static generateAnnualTaxReport(
    closedPositions: ClosedPosition[],
    dividends: DividendTransaction[],
    taxYear: number,
    rateMethod: ExchangeRateMethod = 'GFR_UNIFORM'
  ): AnnualTaxReport {
    // 1. Process Securities Sales (§ 10 & § 4 ZDP)
    const salesInYear = closedPositions.filter((p) => {
      const d = new Date(p.closeDateUtc);
      return !isNaN(d.getTime()) && d.getUTCFullYear() === taxYear;
    });

    const salesItems: TaxSecuritiesSaleItem[] = [];
    let totalGrossSalesAllCZK = 0;
    let exemptGrossSalesTimeTestCZK = 0;
    let nonExemptGrossSalesCZK = 0;
    let nonExemptPurchaseCostsCZK = 0;
    let nonExemptFeesCZK = 0;
    let taxSavedByTimeTestCZK = 0;
    const exemptSalesOver5MCZK: TaxSecuritiesSaleItem[] = [];

    for (const pos of salesInYear) {
      const rate = this.getRateToCZK(pos.instrumentCurrency, taxYear, rateMethod);

      const grossSaleNative = pos.saleValueNative || pos.volume * pos.closePrice;
      const grossSaleCZK = Math.round(grossSaleNative * rate * 100) / 100;

      const purchaseCostNative = pos.purchaseValueNative || pos.volume * pos.openPrice;
      const purchaseCostCZK = Math.round(purchaseCostNative * rate * 100) / 100;

      const feeNative = pos.commissionNative || 0;
      const feeCZK = Math.round(feeNative * rate * 100) / 100;

      const netProfitNative = grossSaleNative - purchaseCostNative - feeNative;
      const netProfitCZK = Math.round((grossSaleCZK - purchaseCostCZK - feeCZK) * 100) / 100;

      const item: TaxSecuritiesSaleItem = {
        id: pos.id,
        ticker: pos.normalizedTicker || pos.rawTicker,
        name: pos.name,
        isin: pos.isin,
        brokerId: pos.brokerId,
        currency: pos.instrumentCurrency,
        volume: pos.volume,
        openDateUtc: pos.openDateUtc,
        closeDateUtc: pos.closeDateUtc,
        holdingPeriodDays: pos.holdingPeriodDays,
        isTimeTestExempt: pos.isTimeTestExempt,
        salePriceNative: pos.closePrice,
        grossSaleNative,
        grossSaleCZK,
        openPriceNative: pos.openPrice,
        purchaseCostNative,
        purchaseCostCZK,
        feeNative,
        feeCZK,
        netProfitNative,
        netProfitCZK,
        isProfitable: netProfitCZK > 0,
        fxRateUsed: rate,
        rateMethodUsed: rateMethod,
      };

      salesItems.push(item);
      totalGrossSalesAllCZK += grossSaleCZK;

      if (pos.isTimeTestExempt) {
        exemptGrossSalesTimeTestCZK += grossSaleCZK;
        if (netProfitCZK > 0) {
          taxSavedByTimeTestCZK += netProfitCZK * 0.15;
        }
        // § 38v ZDP Notification duty (> 5M CZK)
        if (grossSaleCZK >= 5_000_000) {
          exemptSalesOver5MCZK.push(item);
        }
      } else {
        nonExemptGrossSalesCZK += grossSaleCZK;
        nonExemptPurchaseCostsCZK += purchaseCostCZK;
        nonExemptFeesCZK += feeCZK;
      }
    }

    // Evaluate 100 000 CZK exemption (§ 4 odst. 1 písm. v) ZDP)
    const isUnder100kLimit = nonExemptGrossSalesCZK <= 100_000;
    const remaining100kCapacityCZK = Math.max(0, Math.round(100_000 - nonExemptGrossSalesCZK));

    let taxableGrossRevenueCZK = 0;
    let deductiblePurchaseCostsCZK = 0;
    let deductibleFeesCZK = 0;
    let netSecuritiesResultCZK = 0;
    let taxBaseSecuritiesCZK = 0;
    let estimatedTaxSecuritiesCZK = 0;
    let taxSavedBy100kLimitCZK = 0;

    const rawNonExemptNetResult = nonExemptGrossSalesCZK - nonExemptPurchaseCostsCZK - nonExemptFeesCZK;

    if (isUnder100kLimit) {
      taxableGrossRevenueCZK = 0;
      deductiblePurchaseCostsCZK = 0;
      deductibleFeesCZK = 0;
      netSecuritiesResultCZK = Math.round(rawNonExemptNetResult);
      taxBaseSecuritiesCZK = 0;
      estimatedTaxSecuritiesCZK = 0;
      if (netSecuritiesResultCZK > 0) {
        taxSavedBy100kLimitCZK = Math.round(netSecuritiesResultCZK * 0.15);
      }
    } else {
      taxableGrossRevenueCZK = Math.round(nonExemptGrossSalesCZK);
      deductiblePurchaseCostsCZK = Math.round(nonExemptPurchaseCostsCZK);
      deductibleFeesCZK = Math.round(nonExemptFeesCZK);
      netSecuritiesResultCZK = Math.round(rawNonExemptNetResult);
      taxBaseSecuritiesCZK = Math.max(0, netSecuritiesResultCZK);
      estimatedTaxSecuritiesCZK = Math.round(taxBaseSecuritiesCZK * 0.15);
      taxSavedBy100kLimitCZK = 0;
    }

    const securitiesSummary: TaxSecuritiesSummary = {
      taxYear,
      rateMethod,
      totalGrossSalesAllCZK: Math.round(totalGrossSalesAllCZK),
      exemptGrossSalesTimeTestCZK: Math.round(exemptGrossSalesTimeTestCZK),
      nonExemptGrossSalesCZK: Math.round(nonExemptGrossSalesCZK),
      isUnder100kLimit,
      remaining100kCapacityCZK,
      taxableGrossRevenueCZK,
      deductiblePurchaseCostsCZK,
      deductibleFeesCZK,
      netSecuritiesResultCZK,
      taxBaseSecuritiesCZK,
      estimatedTaxSecuritiesCZK,
      taxSavedByTimeTestCZK: Math.round(taxSavedByTimeTestCZK),
      taxSavedBy100kLimitCZK,
      has5MNotificationDuty: exemptSalesOver5MCZK.length > 0,
      exemptSalesOver5MCZK,
    };

    // 2. Process Foreign Dividends (§ 8 ZDP & SZDZ Příloha č. 3)
    const dividendsInYear = dividends.filter((d) => {
      const dt = new Date(d.paymentDateUtc);
      return !isNaN(dt.getTime()) && dt.getUTCFullYear() === taxYear;
    });

    const countryMap = new Map<
      string,
      {
        countryName: string;
        grossCZK: number;
        whtCZK: number;
        dttRate: number;
      }
    >();

    for (const div of dividendsInYear) {
      // Exclude domestic Czech dividends (§ 36 final withholding tax)
      const isDomesticCZ = div.isin?.startsWith('CZ') || div.currency === 'CZK';
      if (isDomesticCZ) continue;

      let country = 'US';
      let countryName = 'Spojené státy americké (USA)';
      let dttRate = 0.15; // Standard 15% DTT rate

      if (div.isin) {
        const prefix = div.isin.slice(0, 2).toUpperCase();
        if (prefix === 'DE') {
          country = 'DE';
          countryName = 'Německo';
          dttRate = 0.15;
        } else if (prefix === 'IE') {
          country = 'IE';
          countryName = 'Irsko';
          dttRate = 0.15;
        } else if (prefix === 'NL') {
          country = 'NL';
          countryName = 'Nizozemsko';
          dttRate = 0.15;
        } else if (prefix === 'GB') {
          country = 'GB';
          countryName = 'Velká Británie';
          dttRate = 0.15;
        }
      }

      const rate = this.getRateToCZK(div.currency, taxYear, rateMethod);
      const grossCZK = div.grossAmount * rate;
      const whtCZK = div.withholdingTax * rate;

      const existing = countryMap.get(country) || {
        countryName,
        grossCZK: 0,
        whtCZK: 0,
        dttRate,
      };

      existing.grossCZK += grossCZK;
      existing.whtCZK += whtCZK;
      countryMap.set(country, existing);
    }

    const countryBreakdown: TaxDividendCountrySummary[] = [];
    let totalGrossForeignDividendsCZK = 0;
    let totalForeignTaxPaidCZK = 0;
    let totalAllowedCreditCZK = 0;
    let netCzechTaxOnDividendsCZK = 0;

    for (const [code, item] of countryMap.entries()) {
      const gross = Math.round(item.grossCZK);
      const paid = Math.round(item.whtCZK);
      const effectiveRate = gross > 0 ? (paid / gross) * 100 : 0;
      
      const czechGross = Math.round(gross * 0.15); // Czech 15%
      const allowedCredit = Math.min(paid, Math.round(gross * item.dttRate));
      const czechDue = Math.max(0, czechGross - allowedCredit);

      countryBreakdown.push({
        countryCode: code,
        countryName: item.countryName,
        grossDividendsCZK: gross,
        foreignTaxPaidCZK: paid,
        effectiveForeignTaxRate: Math.round(effectiveRate * 10) / 10,
        dttAllowedCreditRate: item.dttRate * 100,
        allowedCreditCZK: allowedCredit,
        czechTaxGrossCZK: czechGross,
        czechTaxDueCZK: czechDue,
      });

      totalGrossForeignDividendsCZK += gross;
      totalForeignTaxPaidCZK += paid;
      totalAllowedCreditCZK += allowedCredit;
      netCzechTaxOnDividendsCZK += czechDue;
    }

    const dividendsSummary: TaxDividendsSummary = {
      taxYear,
      totalGrossForeignDividendsCZK,
      totalForeignTaxPaidCZK,
      totalAllowedCreditCZK,
      netCzechTaxOnDividendsCZK,
      countryBreakdown,
    };

    const totalEstimatedTaxDueCZK = estimatedTaxSecuritiesCZK + netCzechTaxOnDividendsCZK;
    const totalTaxSavingsCZK = securitiesSummary.taxSavedByTimeTestCZK + securitiesSummary.taxSavedBy100kLimitCZK;

    return {
      taxYear,
      rateMethod,
      generatedAt: new Date().toISOString(),
      securities: securitiesSummary,
      dividends: dividendsSummary,
      totalEstimatedTaxDueCZK,
      totalTaxSavingsCZK,
      salesItems,
    };
  }

  /**
   * Generates audit-proof CSV text for tax advisor / accountant
   */
  static exportTaxReportToCsv(report: AnnualTaxReport): string {
    const lines: string[] = [];

    lines.push(`DAŇOVÝ REPORT PRO PŘIZNÁNÍ K DANI Z PŘÍJMŮ FO — ROK ${report.taxYear}`);
    lines.push(`Vygenerováno: ${new Date(report.generatedAt).toLocaleString('cs-CZ')}`);
    lines.push(`Použitá metoda kurzů: ${report.rateMethod === 'GFR_UNIFORM' ? 'Jednotný kurz GFŘ' : 'Denní kurz ČNB'}`);
    lines.push('');

    // Summary block
    lines.push('--- SOUHRN PRO DAŇOVÉ PŘIZNÁNÍ ---');
    lines.push(`Příloha č. 2 (§ 10 ZDP - Cenné papíry) - Hrubé příjmy:;${report.securities.taxableGrossRevenueCZK} Kč`);
    lines.push(`Příloha č. 2 (§ 10 ZDP - Cenné papíry) - Výdaje (FIFO):;${report.securities.deductiblePurchaseCostsCZK + report.securities.deductibleFeesCZK} Kč`);
    lines.push(`Příloha č. 2 (§ 10 ZDP - Cenné papíry) - Dílčí základ daně:;${report.securities.taxBaseSecuritiesCZK} Kč`);
    lines.push(`Příloha č. 2 - Daň 15 %:;${report.securities.estimatedTaxSecuritiesCZK} Kč`);
    lines.push(`Limit 100 000 Kč (§ 4 odst. 1 písm. v) ZDP:;${report.securities.isUnder100kLimit ? 'SPLNĚN (OSVOBOZENO)' : 'PŘEKROČEN'}`);
    lines.push(`Příloha č. 3 (§ 8 ZDP - Zahraniční dividendy) - Hrubé příjmy:;${report.dividends.totalGrossForeignDividendsCZK} Kč`);
    lines.push(`Příloha č. 3 (§ 8 ZDP) - Uplatněný zápočet daně ze zahraničí:;${report.dividends.totalAllowedCreditCZK} Kč`);
    lines.push(`Příloha č. 3 - Doplatek daně v ČR:;${report.dividends.netCzechTaxOnDividendsCZK} Kč`);
    lines.push(`CELKOVÁ DAŇOVÁ POVINNOST K ÚHRADĚ:;${report.totalEstimatedTaxDueCZK} Kč`);
    lines.push(`CELKOVÁ ÚSPORA NA DANI (3letý test + 100k limit):;${report.totalTaxSavingsCZK} Kč`);
    lines.push('');

    // Table of sales
    lines.push('--- ROZPIS PRODEJŮ CENNÝCH PAPÍRŮ (§ 10 A § 4 ZDP) ---');
    lines.push('Ticker;Název;Broker;Datum nákupu;Datum prodeje;Držení (dny);Osvobozeno (§ 4);Prodejní cena CZK;Nabývací cena CZK;Poplatky CZK;Zisk/Ztráta CZK;Použitý kurz');
    for (const item of report.salesItems) {
      lines.push(
        [
          item.ticker,
          `"${item.name}"`,
          item.brokerId,
          new Date(item.openDateUtc).toLocaleDateString('cs-CZ'),
          new Date(item.closeDateUtc).toLocaleDateString('cs-CZ'),
          item.holdingPeriodDays,
          item.isTimeTestExempt ? 'ANO (3 roky)' : 'NE (< 3 roky)',
          item.grossSaleCZK,
          item.purchaseCostCZK,
          item.feeCZK,
          item.netProfitCZK,
          item.fxRateUsed,
        ].join(';')
      );
    }
    lines.push('');

    // Table of foreign dividends
    lines.push('--- ROZPIS ZAHRANIČNÍCH DIVIDEND PODLE STÁTŮ (PŘÍLOHA Č. 3) ---');
    lines.push('Stát zdroje;Kód státu;Hrubá dividenda CZK;Sražená daň v zahraničí CZK;Efektivní sazba;Sazba dle SZDZ;Uplatnitelný zápočet CZK;Daň v ČR 15 %;Doplatek v ČR CZK');
    for (const c of report.dividends.countryBreakdown) {
      lines.push(
        [
          c.countryName,
          c.countryCode,
          c.grossDividendsCZK,
          c.foreignTaxPaidCZK,
          `${c.effectiveForeignTaxRate} %`,
          `${c.dttAllowedCreditRate} %`,
          c.allowedCreditCZK,
          c.czechTaxGrossCZK,
          c.czechTaxDueCZK,
        ].join(';')
      );
    }

    return lines.join('\n');
  }
}
