import { describe, it, expect } from 'bun:test';
import { CzechTaxService } from '@/lib/services/czechTaxService';
import { ClosedPosition } from '@/types/portfolio';
import { DividendTransaction } from '@/types/dividend';

describe('CzechTaxService (Czech Income Tax § 4, § 8, § 10 ZDP)', () => {
  it('correctly exempts non-exempt trades when total non-exempt gross sales <= 100,000 CZK', () => {
    const closedPositions: ClosedPosition[] = [
      // Trade 1: Non-exempt (< 3 yrs), sale 45,000 CZK, purchase 30,000 CZK, gain +15,000 CZK
      {
        id: 'T1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'AAPL',
        normalizedTicker: 'AAPL',
        name: 'Apple Inc.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        volume: 10,
        openPrice: 3000,
        openDateUtc: '2024-03-01T10:00:00Z',
        closePrice: 4500,
        closeDateUtc: '2024-10-15T10:00:00Z',
        holdingPeriodDays: 228,
        isTimeTestExempt: false,
        purchaseValueNative: 30000,
        saleValueNative: 45000,
        profitNative: 15000,
        profitPercent: 50,
        commissionNative: 0,
        purchaseValueTarget: 30000,
        saleValueTarget: 45000,
        profitTarget: 15000,
        commissionTarget: 0,
        estimatedTaxSavedTarget: 0,
      },
      // Trade 2: Non-exempt (< 3 yrs), sale 50,000 CZK, purchase 35,000 CZK, gain +15,000 CZK
      {
        id: 'T2',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'MSFT',
        normalizedTicker: 'MSFT',
        name: 'Microsoft Corp.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        volume: 5,
        openPrice: 7000,
        openDateUtc: '2024-02-01T10:00:00Z',
        closePrice: 10000,
        closeDateUtc: '2024-11-20T10:00:00Z',
        holdingPeriodDays: 293,
        isTimeTestExempt: false,
        purchaseValueNative: 35000,
        saleValueNative: 50000,
        profitNative: 15000,
        profitPercent: 42.8,
        commissionNative: 0,
        purchaseValueTarget: 35000,
        saleValueTarget: 50000,
        profitTarget: 15000,
        commissionTarget: 0,
        estimatedTaxSavedTarget: 0,
      },
      // Trade 3: Exempt under 3-year time test (holding >= 1096 days), sale 1,200,000 CZK
      {
        id: 'T3',
        accountId: 'acc-1',
        brokerId: 'DEGIRO',
        rawTicker: 'VWCE.DE',
        normalizedTicker: 'VWCE.DE',
        name: 'Vanguard FTSE All-World',
        assetClass: 'ETF',
        instrumentCurrency: 'CZK',
        volume: 500,
        openPrice: 1600,
        openDateUtc: '2020-01-10T10:00:00Z',
        closePrice: 2400,
        closeDateUtc: '2024-05-15T10:00:00Z',
        holdingPeriodDays: 1587,
        isTimeTestExempt: true,
        purchaseValueNative: 800000,
        saleValueNative: 1200000,
        profitNative: 400000,
        profitPercent: 50,
        commissionNative: 0,
        purchaseValueTarget: 800000,
        saleValueTarget: 1200000,
        profitTarget: 400000,
        commissionTarget: 0,
        estimatedTaxSavedTarget: 60000,
      },
    ];

    const report = CzechTaxService.generateAnnualTaxReport(closedPositions, [], 2024, 'GFR_UNIFORM');

    // Total non-exempt gross sales = 45k + 50k = 95k CZK <= 100k CZK
    expect(report.securities.nonExemptGrossSalesCZK).toBe(95000);
    expect(report.securities.isUnder100kLimit).toBe(true);
    expect(report.securities.remaining100kCapacityCZK).toBe(5000);

    // Because under 100k limit, taxable gross revenue is 0 and tax base is 0 CZK
    expect(report.securities.taxableGrossRevenueCZK).toBe(0);
    expect(report.securities.taxBaseSecuritiesCZK).toBe(0);
    expect(report.securities.estimatedTaxSecuritiesCZK).toBe(0);

    // Exempt under time test (1.2M CZK)
    expect(report.securities.exemptGrossSalesTimeTestCZK).toBe(1200000);
    expect(report.securities.taxSavedByTimeTestCZK).toBe(60000); // 15% of 400k
    expect(report.securities.taxSavedBy100kLimitCZK).toBe(4500); // 15% of 30k non-exempt profit
    expect(report.securities.has5MNotificationDuty).toBe(false);
  });

  it('correctly calculates § 10 Tax Base and applies loss offset when non-exempt gross sales > 100,000 CZK', () => {
    const closedPositions: ClosedPosition[] = [
      // Trade 1: Gain +24,500 CZK (Sale 55,000 CZK, Cost 30,000 CZK, Fee 500 CZK)
      {
        id: 'T1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'NVDA',
        normalizedTicker: 'NVDA',
        name: 'NVIDIA Corp.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        volume: 5,
        openPrice: 6000,
        openDateUtc: '2024-01-10T10:00:00Z',
        closePrice: 11000,
        closeDateUtc: '2024-06-20T10:00:00Z',
        holdingPeriodDays: 162,
        isTimeTestExempt: false,
        purchaseValueNative: 30000,
        saleValueNative: 55000,
        profitNative: 24500,
        profitPercent: 81.6,
        commissionNative: 500,
        purchaseValueTarget: 30000,
        saleValueTarget: 55000,
        profitTarget: 24500,
        commissionTarget: 500,
        estimatedTaxSavedTarget: 0,
      },
      // Trade 2: Loss -20,500 CZK (Sale 60,000 CZK, Cost 80,000 CZK, Fee 500 CZK)
      {
        id: 'T2',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'TSLA',
        normalizedTicker: 'TSLA',
        name: 'Tesla Inc.',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        volume: 10,
        openPrice: 8000,
        openDateUtc: '2024-02-10T10:00:00Z',
        closePrice: 6000,
        closeDateUtc: '2024-08-20T10:00:00Z',
        holdingPeriodDays: 192,
        isTimeTestExempt: false,
        purchaseValueNative: 80000,
        saleValueNative: 60000,
        profitNative: -20500,
        profitPercent: -25.6,
        commissionNative: 500,
        purchaseValueTarget: 80000,
        saleValueTarget: 60000,
        profitTarget: -20500,
        commissionTarget: 500,
        estimatedTaxSavedTarget: 0,
      },
    ];

    const report = CzechTaxService.generateAnnualTaxReport(closedPositions, [], 2024, 'GFR_UNIFORM');

    // Total gross = 55k + 60k = 115k CZK (> 100k CZK threshold)
    expect(report.securities.nonExemptGrossSalesCZK).toBe(115000);
    expect(report.securities.isUnder100kLimit).toBe(false);

    // Total deductible costs = 30k + 80k = 110k CZK; fees = 1,000 CZK
    // Net result = 115,000 - 110,000 - 1,000 = 4,000 CZK
    expect(report.securities.taxBaseSecuritiesCZK).toBe(4000);
    expect(report.securities.estimatedTaxSecuritiesCZK).toBe(600); // 15% of 4,000
  });

  it('enforces 0 CZK floor on § 10 Tax Base when overall securities result is a net loss', () => {
    const closedPositions: ClosedPosition[] = [
      {
        id: 'T1',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'BABA',
        normalizedTicker: 'BABA',
        name: 'Alibaba Group',
        assetClass: 'EQUITY',
        instrumentCurrency: 'CZK',
        volume: 100,
        openPrice: 3000,
        openDateUtc: '2024-01-01T10:00:00Z',
        closePrice: 1500,
        closeDateUtc: '2024-09-01T10:00:00Z',
        holdingPeriodDays: 244,
        isTimeTestExempt: false,
        purchaseValueNative: 300000,
        saleValueNative: 150000,
        profitNative: -150000,
        profitPercent: -50,
        commissionNative: 0,
        purchaseValueTarget: 300000,
        saleValueTarget: 150000,
        profitTarget: -150000,
        commissionTarget: 0,
        estimatedTaxSavedTarget: 0,
      },
    ];

    const report = CzechTaxService.generateAnnualTaxReport(closedPositions, [], 2024, 'GFR_UNIFORM');

    expect(report.securities.nonExemptGrossSalesCZK).toBe(150000); // > 100k
    expect(report.securities.netSecuritiesResultCZK).toBe(-150000);
    // Strict 0 CZK tax base floor under § 10(4)
    expect(report.securities.taxBaseSecuritiesCZK).toBe(0);
    expect(report.securities.estimatedTaxSecuritiesCZK).toBe(0);
  });

  it('triggers § 38v ZDP notification warning when exempt sale exceeds 5,000,000 CZK', () => {
    const closedPositions: ClosedPosition[] = [
      {
        id: 'BIG_EXEMPT',
        accountId: 'acc-1',
        brokerId: 'XTB',
        rawTicker: 'VUAA.UK',
        normalizedTicker: 'VUAA.L',
        name: 'S&P 500 ETF',
        assetClass: 'ETF',
        instrumentCurrency: 'CZK',
        volume: 1000,
        openPrice: 3000,
        openDateUtc: '2020-01-01T10:00:00Z',
        closePrice: 5500,
        closeDateUtc: '2024-06-01T10:00:00Z',
        holdingPeriodDays: 1613, // > 3 years
        isTimeTestExempt: true,
        purchaseValueNative: 3000000,
        saleValueNative: 5500000, // 5.5M CZK > 5M CZK
        profitNative: 2500000,
        profitPercent: 83.3,
        commissionNative: 0,
        purchaseValueTarget: 3000000,
        saleValueTarget: 5500000,
        profitTarget: 2500000,
        commissionTarget: 0,
        estimatedTaxSavedTarget: 375000,
      },
    ];

    const report = CzechTaxService.generateAnnualTaxReport(closedPositions, [], 2024, 'GFR_UNIFORM');

    expect(report.securities.exemptGrossSalesTimeTestCZK).toBe(5500000);
    expect(report.securities.has5MNotificationDuty).toBe(true);
    expect(report.securities.exemptSalesOver5MCZK.length).toBe(1);
  });

  it('calculates foreign dividend credit under DTT (Příloha č. 3)', () => {
    const dividends: DividendTransaction[] = [
      // US Dividend with 15% W-8BEN withholding tax
      {
        id: 'div-1',
        profileId: 'prof-1',
        accountId: 'acc-1',
        brokerId: 'IBKR',
        rawTicker: 'MSFT.US',
        normalizedTicker: 'MSFT',
        isin: 'US5949181045',
        currency: 'USD',
        grossAmount: 1000,
        withholdingTax: 150, // 15%
        netAmount: 850,
        paymentDateUtc: '2024-04-15T00:00:00Z',
        yearMonth: '2024-04',
        fxRateToCZK: 23.27,
        grossAmountCZK: 23270,
        withholdingTaxCZK: 3490.5,
        netAmountCZK: 19779.5,
      },
    ];

    // GFŘ 2024 rate: 1 USD = 23.27 CZK
    const report = CzechTaxService.generateAnnualTaxReport([], dividends, 2024, 'GFR_UNIFORM');

    expect(report.dividends.countryBreakdown.length).toBe(1);
    const usItem = report.dividends.countryBreakdown[0];

    // Gross = 1,000 * 23.27 = 23,270 CZK
    expect(usItem.grossDividendsCZK).toBe(23270);
    // Paid = 150 * 23.27 = 3,491 CZK
    expect(usItem.foreignTaxPaidCZK).toBe(3491);
    // Allowed credit = 3,491 CZK (15%)
    expect(usItem.allowedCreditCZK).toBe(3491);
    // Czech tax gross (15%) = 3,491 CZK -> Net Czech tax due = 0 CZK!
    expect(usItem.czechTaxDueCZK).toBe(0);
    expect(report.dividends.netCzechTaxOnDividendsCZK).toBe(0);
  });

  it('generates structured CSV export text with all statutory lines', () => {
    const report = CzechTaxService.generateAnnualTaxReport([], [], 2024, 'GFR_UNIFORM');
    const csv = CzechTaxService.exportTaxReportToCsv(report);

    expect(csv).toContain('DAŇOVÝ REPORT PRO PŘIZNÁNÍ K DANI Z PŘÍJMŮ FO — ROK 2024');
    expect(csv).toContain('Příloha č. 2 (§ 10 ZDP - Cenné papíry)');
    expect(csv).toContain('Příloha č. 3 (§ 8 ZDP - Zahraniční dividendy)');
  });
});
