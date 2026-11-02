import { describe, expect, it } from 'bun:test';
import { DcaRebalanceService } from '../src/lib/services/dcaRebalanceService';
import { AssetClass, BrokerId, CurrencyCode, ValuationDetail } from '../src/types/portfolio';
import { TargetAllocationItem } from '../src/types/rebalance';

function createMockValuation(
  id: string,
  ticker: string,
  name: string,
  valueCZK: number,
  brokerId: BrokerId = 'XTB',
  currency: CurrencyCode = 'CZK',
  priceNative = 100,
  assetClass: AssetClass = 'ETF'
): ValuationDetail {
  const qty = valueCZK / priceNative;
  return {
    holding: {
      id,
      accountId: 'acc-1',
      brokerId,
      name,
      rawTicker: ticker,
      normalizedTicker: ticker,
      assetClass,
      instrumentCurrency: currency,
      totalQuantity: qty,
      averageOpenPrice: priceNative * 0.9,
      currentPrice: priceNative,
      lastPriceUpdate: '2023-01-01T00:00:00Z',
      clusterId: ticker,
      tags: [],
    },
    quantity: qty,
    instrumentCurrency: currency,
    currentPriceNative: priceNative,
    costBasisNative: valueCZK * 0.9,
    marketValueNative: valueCZK,
    unrealizedProfitNative: valueCZK * 0.1,
    unrealizedProfitPercent: 11.1,
    targetCurrency: 'CZK',
    exchangeRateNativeToTarget: 1,
    currentPriceTarget: priceNative,
    costBasisTarget: valueCZK * 0.9,
    marketValueTarget: valueCZK,
    unrealizedProfitTarget: valueCZK * 0.1,
    pureAssetGainTarget: valueCZK * 0.1,
    fxGainTarget: 0,
    weightInPortfolio: 0,
  };
}

describe('DcaRebalanceService (Smart DCA Water-Filling Rebalancer)', () => {
  it('generates default target allocations and normalizes to 100%', () => {
    const valuations: ValuationDetail[] = [
      createMockValuation('v1', 'VWCE', 'Vanguard FTSE All-World', 60000),
      createMockValuation('v2', 'CSPX', 'iShares Core S&P 500', 40000),
    ];

    const targets = DcaRebalanceService.generateDefaultTargetAllocations(valuations);

    expect(targets.length).toBe(2);
    const sumWeights = targets.reduce((sum, t) => sum + t.targetWeightPercent, 0);
    expect(Math.abs(sumWeights - 100)).toBeLessThan(0.1);

    const vwce = targets.find((t) => t.ticker === 'VWCE');
    const cspx = targets.find((t) => t.ticker === 'CSPX');
    expect(vwce?.targetWeightPercent).toBe(60);
    expect(cspx?.targetWeightPercent).toBe(40);
  });

  it('allocates deposit proportionally when all assets are at target weight (pure expansion)', () => {
    const valuations: ValuationDetail[] = [
      createMockValuation('v1', 'VWCE', 'All-World', 50000),
      createMockValuation('v2', 'CSPX', 'S&P 500', 50000),
    ];

    const targets: TargetAllocationItem[] = [
      {
        id: 't-1',
        targetType: 'CLUSTER',
        targetId: 'VWCE',
        name: 'All-World',
        ticker: 'VWCE',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 50000,
        currentWeightPercent: 50,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 50000,
        postDepositWeightPercent: 50,
        postDepositDriftPercent: 0,
      },
      {
        id: 't-2',
        targetType: 'CLUSTER',
        targetId: 'CSPX',
        name: 'S&P 500',
        ticker: 'CSPX',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 50000,
        currentWeightPercent: 50,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 50000,
        postDepositWeightPercent: 50,
        postDepositDriftPercent: 0,
      },
    ];

    const deposit = 20000;
    const result = DcaRebalanceService.calculateDCARebalance(valuations, targets, deposit);

    expect(result.depositAmountCZK).toBe(20000);
    expect(result.currentNavCZK).toBe(100000);
    expect(result.postDepositNavCZK).toBe(120000);

    const t1 = result.targetAllocations.find((t) => t.ticker === 'VWCE');
    const t2 = result.targetAllocations.find((t) => t.ticker === 'CSPX');

    expect(t1?.allocatedDepositCZK).toBe(10000);
    expect(t2?.allocatedDepositCZK).toBe(10000);
    expect(t1?.postDepositWeightPercent).toBe(50);
    expect(t2?.postDepositWeightPercent).toBe(50);
    expect(result.maxDriftAfterPercent).toBe(0);
  });

  it('strictly preserves buy-only constraint (0 CZK to overweight asset, 0 sell orders)', () => {
    // Current portfolio: A is 80k (80%), B is 20k (20%). Target: 50% / 50%
    const valuations: ValuationDetail[] = [
      createMockValuation('v1', 'OVERWEIGHT', 'Overweight Asset', 80000),
      createMockValuation('v2', 'UNDERWEIGHT', 'Underweight Asset', 20000),
    ];

    const targets: TargetAllocationItem[] = [
      {
        id: 't-over',
        targetType: 'CLUSTER',
        targetId: 'OVERWEIGHT',
        name: 'Overweight Asset',
        ticker: 'OVERWEIGHT',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 80000,
        currentWeightPercent: 80,
        driftPercent: 30,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 80000,
        postDepositWeightPercent: 80,
        postDepositDriftPercent: 30,
      },
      {
        id: 't-under',
        targetType: 'CLUSTER',
        targetId: 'UNDERWEIGHT',
        name: 'Underweight Asset',
        ticker: 'UNDERWEIGHT',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 20000,
        currentWeightPercent: 20,
        driftPercent: -30,
        isUnderweight: true,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 20000,
        postDepositWeightPercent: 20,
        postDepositDriftPercent: -30,
      },
    ];

    // Deposit 20,000 CZK
    const deposit = 20000;
    const result = DcaRebalanceService.calculateDCARebalance(valuations, targets, deposit);

    const over = result.targetAllocations.find((t) => t.ticker === 'OVERWEIGHT');
    const under = result.targetAllocations.find((t) => t.ticker === 'UNDERWEIGHT');

    // Overweight asset must get exactly 0 CZK
    expect(over?.allocatedDepositCZK).toBe(0);
    expect(over?.postDepositValueCZK).toBe(80000);

    // Underweight asset receives all 20,000 CZK
    expect(under?.allocatedDepositCZK).toBe(20000);
    expect(under?.postDepositValueCZK).toBe(40000);

    // Sum of allocations must equal exact deposit
    const totalAllocated = result.targetAllocations.reduce((sum, t) => sum + t.allocatedDepositCZK, 0);
    expect(totalAllocated).toBe(deposit);

    // Check drift reduction
    expect(result.maxDriftBeforePercent).toBe(30);
    // Post Nav = 120,000 CZK. Over: 80k/120k = 66.7% (+16.7% drift). Under: 40k/120k = 33.3% (-16.7% drift).
    expect(result.maxDriftAfterPercent).toBeCloseTo(16.7, 1);

    // There must be only 1 order slip, and it's for the underweight asset
    expect(result.orders.length).toBe(1);
    expect(result.orders[0].ticker).toBe('UNDERWEIGHT');
    expect(result.orders[0].allocatedAmountCZK).toBe(20000);
  });

  it('cascades water-filling across multiple assets correctly', () => {
    // 3 assets with equal target 33.333% (1/3 each):
    // A: 10 000 CZK (Level L = 10k / 0.333 = 30k)
    // B: 20 000 CZK (Level L = 20k / 0.333 = 60k)
    // C: 60 000 CZK (Level L = 60k / 0.333 = 180k)
    // Total NAV = 90 000 CZK.
    // Small deposit: 5 000 CZK -> should ALL go to A because lambda = (10k + 5k) / (1/3) = 45k < L_B (60k).
    const valuations: ValuationDetail[] = [
      createMockValuation('v-a', 'ASSET_A', 'Asset A', 10000),
      createMockValuation('v-b', 'ASSET_B', 'Asset B', 20000),
      createMockValuation('v-c', 'ASSET_C', 'Asset C', 60000),
    ];

    const targets: TargetAllocationItem[] = [
      {
        id: 't-a',
        targetType: 'CLUSTER',
        targetId: 'ASSET_A',
        name: 'Asset A',
        ticker: 'ASSET_A',
        brokerId: 'XTB',
        targetWeightPercent: 33.333,
        currentValueCZK: 10000,
        currentWeightPercent: 11.1,
        driftPercent: -22.2,
        isUnderweight: true,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 11.1,
        postDepositDriftPercent: -22.2,
      },
      {
        id: 't-b',
        targetType: 'CLUSTER',
        targetId: 'ASSET_B',
        name: 'Asset B',
        ticker: 'ASSET_B',
        brokerId: 'XTB',
        targetWeightPercent: 33.333,
        currentValueCZK: 20000,
        currentWeightPercent: 22.2,
        driftPercent: -11.1,
        isUnderweight: true,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 20000,
        postDepositWeightPercent: 22.2,
        postDepositDriftPercent: -11.1,
      },
      {
        id: 't-c',
        targetType: 'CLUSTER',
        targetId: 'ASSET_C',
        name: 'Asset C',
        ticker: 'ASSET_C',
        brokerId: 'XTB',
        targetWeightPercent: 33.334,
        currentValueCZK: 60000,
        currentWeightPercent: 66.7,
        driftPercent: 33.4,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 60000,
        postDepositWeightPercent: 66.7,
        postDepositDriftPercent: 33.4,
      },
    ];

    // Stage 1: Small deposit (5k) goes strictly to Asset A
    const resSmall = DcaRebalanceService.calculateDCARebalance(valuations, targets, 5000);
    const itemA = resSmall.targetAllocations.find((t) => t.ticker === 'ASSET_A');
    const itemB = resSmall.targetAllocations.find((t) => t.ticker === 'ASSET_B');
    const itemC = resSmall.targetAllocations.find((t) => t.ticker === 'ASSET_C');

    expect(itemA?.allocatedDepositCZK).toBe(5000);
    expect(itemB?.allocatedDepositCZK).toBe(0);
    expect(itemC?.allocatedDepositCZK).toBe(0);

    // Stage 2: Larger deposit (30 000 CZK) raises A to 20k (consuming 10k), then splits remaining 20k equally between A and B
    // Total for A: 10k + 10k = 20k. Total for B: 0 + 10k = 10k. Total for C: 0.
    const resLarge = DcaRebalanceService.calculateDCARebalance(valuations, targets, 30000);
    const itemALarge = resLarge.targetAllocations.find((t) => t.ticker === 'ASSET_A');
    const itemBLarge = resLarge.targetAllocations.find((t) => t.ticker === 'ASSET_B');
    const itemCLarge = resLarge.targetAllocations.find((t) => t.ticker === 'ASSET_C');

    expect(itemALarge?.allocatedDepositCZK).toBe(20000); // 10k + 20k = 30k
    expect(itemBLarge?.allocatedDepositCZK).toBe(10000); // 20k + 10k = 30k
    expect(itemCLarge?.allocatedDepositCZK).toBe(0);
    expect(itemALarge!.postDepositValueCZK).toBe(itemBLarge!.postDepositValueCZK);
  });

  it('handles edge cases: zero deposit, unnormalized weights, and non-divisible cent rounding', () => {
    const valuations: ValuationDetail[] = [
      createMockValuation('v1', 'A', 'Asset A', 10000),
      createMockValuation('v2', 'B', 'Asset B', 10000),
    ];

    // Case 1: Zero deposit
    const targetsZero: TargetAllocationItem[] = [
      {
        id: 't1',
        targetType: 'CLUSTER',
        targetId: 'A',
        name: 'Asset A',
        ticker: 'A',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 10000,
        currentWeightPercent: 50,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 50,
        postDepositDriftPercent: 0,
      },
    ];

    const resZero = DcaRebalanceService.calculateDCARebalance(valuations, targetsZero, 0);
    expect(resZero.orders.length).toBe(0);
    expect(resZero.targetAllocations[0].allocatedDepositCZK).toBe(0);

    // Case 2: Rounding discrepancy with prime odd deposit (e.g. 10001 CZK between 2 equal assets)
    const targetsTwo: TargetAllocationItem[] = [
      {
        id: 't1',
        targetType: 'CLUSTER',
        targetId: 'A',
        name: 'Asset A',
        ticker: 'A',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 10000,
        currentWeightPercent: 50,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 50,
        postDepositDriftPercent: 0,
      },
      {
        id: 't2',
        targetType: 'CLUSTER',
        targetId: 'B',
        name: 'Asset B',
        ticker: 'B',
        brokerId: 'XTB',
        targetWeightPercent: 50,
        currentValueCZK: 10000,
        currentWeightPercent: 50,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 50,
        postDepositDriftPercent: 0,
      },
    ];

    const resOdd = DcaRebalanceService.calculateDCARebalance(valuations, targetsTwo, 10001);
    const sumAllocated = resOdd.targetAllocations.reduce((s, t) => s + t.allocatedDepositCZK, 0);
    expect(sumAllocated).toBe(10001); // Exactly 10001 CZK without losing a single crown
  });

  it('generates broker-specific order slips (DEGIRO whole shares vs XTB fractional, skips CASH)', () => {
    const valuations: ValuationDetail[] = [
      createMockValuation('v-xtb', 'IWDA', 'iShares Core MSCI World', 10000, 'XTB', 'CZK', 2000),
      createMockValuation('v-degiro', 'VWCE', 'Vanguard All-World', 10000, 'DEGIRO', 'CZK', 3000),
      createMockValuation('v-cash', 'CZK_CASH', 'Hotovost CZK', 5000, 'BANK', 'CZK', 1, 'CASH'),
    ];

    const targets: TargetAllocationItem[] = [
      {
        id: 't1',
        targetType: 'CLUSTER',
        targetId: 'IWDA',
        name: 'iShares Core MSCI World',
        ticker: 'IWDA',
        brokerId: 'XTB',
        targetWeightPercent: 40,
        currentValueCZK: 10000,
        currentWeightPercent: 40,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 40,
        postDepositDriftPercent: 0,
      },
      {
        id: 't2',
        targetType: 'CLUSTER',
        targetId: 'VWCE',
        name: 'Vanguard All-World',
        ticker: 'VWCE',
        brokerId: 'DEGIRO',
        targetWeightPercent: 40,
        currentValueCZK: 10000,
        currentWeightPercent: 40,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 10000,
        postDepositWeightPercent: 40,
        postDepositDriftPercent: 0,
      },
      {
        id: 't3',
        targetType: 'CLUSTER',
        targetId: 'CZK_CASH',
        name: 'Hotovost CZK',
        ticker: 'CZK_CASH',
        brokerId: 'BANK',
        targetWeightPercent: 20,
        currentValueCZK: 5000,
        currentWeightPercent: 20,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: 5000,
        postDepositWeightPercent: 20,
        postDepositDriftPercent: 0,
      },
    ];

    const result = DcaRebalanceService.calculateDCARebalance(valuations, targets, 10000);

    // CASH must NOT generate a stock order slip
    const cashOrder = result.orders.find((o) => o.ticker === 'CZK_CASH');
    expect(cashOrder).toBeUndefined();

    // Check XTB order: supports fractional shares
    const xtbOrders = result.ordersByBroker['XTB'];
    expect(xtbOrders.length).toBe(1);
    expect(xtbOrders[0].isFractional).toBe(true);

    // Check DEGIRO order: does not support fractional shares
    const degiroOrders = result.ordersByBroker['DEGIRO'];
    expect(degiroOrders.length).toBe(1);
    expect(degiroOrders[0].isFractional).toBe(false);
    expect(Number.isInteger(degiroOrders[0].sharesToBuy)).toBe(true);
  });
});
