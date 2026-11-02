import { BrokerId, Holding, ValuationDetail } from '@/types/portfolio';
import {
  DCARebalanceResult,
  RebalanceOrderSlip,
  RebalancePreset,
  TargetAllocationItem,
} from '@/types/rebalance';
import { CurrencyService } from './currencyService';

export class DcaRebalanceService {
  public static readonly DEFAULT_PRESETS: RebalancePreset[] = [
    {
      id: 'core_satellite_80_20',
      name: '80/20 Core & Satellite',
      description: '70% S&P 500, 15% All-World/Tech, 5% Zlato & Komodity, 10% Hotovostní rezerva',
      targets: [
        { targetName: 'S&P 500 Core', weightPercent: 70 },
        { targetName: 'All-World / Globální', weightPercent: 15 },
        { targetName: 'Zlato & Komodity', weightPercent: 5 },
        { targetName: 'Volná hotovost', weightPercent: 10 },
      ],
    },
    {
      id: 'passive_100_equity',
      name: '100% Pasivní Indexy',
      description: '80% S&P 500 a 20% All-World ETF pro maximální dlouhodobý růst',
      targets: [
        { targetName: 'S&P 500 Core', weightPercent: 80 },
        { targetName: 'All-World / Globální', weightPercent: 20 },
      ],
    },
    {
      id: 'balanced_czech',
      name: 'České & Globální portfolio',
      description: '60% S&P 500, 20% České dividendové akcie (ČEZ, Moneta), 10% Zlato, 10% Hotovost',
      targets: [
        { targetName: 'S&P 500 Core', weightPercent: 60 },
        { targetName: 'České dividendové akcie', weightPercent: 20 },
        { targetName: 'Zlato & Komodity', weightPercent: 10 },
        { targetName: 'Volná hotovost', weightPercent: 10 },
      ],
    },
  ];

  /**
   * Generates target allocation items from current holdings / clusters
   */
  static generateDefaultTargetAllocations(
    valuations: ValuationDetail[]
  ): TargetAllocationItem[] {
    const totalNavCZK = valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
    const validNav = Math.max(1, totalNavCZK);

    // Group by cluster or unique name
    const groupMap = new Map<
      string,
      {
        name: string;
        valueCZK: number;
        brokerId?: BrokerId;
        ticker?: string;
      }
    >();

    for (const v of valuations) {
      const clusterName = v.holding.clusterId || v.holding.name;
      const existing = groupMap.get(clusterName) || {
        name: clusterName,
        valueCZK: 0,
        brokerId: v.holding.brokerId,
        ticker: v.holding.normalizedTicker,
      };
      existing.valueCZK += v.marketValueTarget;
      groupMap.set(clusterName, existing);
    }

    const items: TargetAllocationItem[] = [];

    for (const [key, g] of groupMap.entries()) {
      const currentWeight = Math.round((g.valueCZK / validNav) * 1000) / 10;
      // Default target weight matches current rounded weight
      const targetWeight = currentWeight;

      items.push({
        id: `target-${key}`,
        targetType: 'CLUSTER',
        targetId: key,
        name: g.name,
        ticker: g.ticker,
        brokerId: g.brokerId,
        targetWeightPercent: targetWeight,
        currentValueCZK: Math.round(g.valueCZK),
        currentWeightPercent: currentWeight,
        driftPercent: 0,
        isUnderweight: false,
        allocatedDepositCZK: 0,
        postDepositValueCZK: Math.round(g.valueCZK),
        postDepositWeightPercent: currentWeight,
        postDepositDriftPercent: 0,
      });
    }

    // Ensure sum of target weights = 100%
    this.normalizeTargetWeights(items);

    return items;
  }

  /**
   * Normalizes target weights to ensure they sum to exactly 100.0%
   */
  static normalizeTargetWeights(items: TargetAllocationItem[]): void {
    const sum = items.reduce((acc, i) => acc + i.targetWeightPercent, 0);
    if (sum === 0) return;
    if (Math.abs(sum - 100) > 0.05) {
      for (const item of items) {
        item.targetWeightPercent = Math.round((item.targetWeightPercent / sum) * 1000) / 10;
      }
    }
  }

  /**
   * Water-Filling Cashflow Rebalancing Algorithm
   * Strictly enforces buy-only constraint (a_i >= 0, sum a_i = C)
   * Optimal analytical KKT water-filling:
   * Level L_i = V_i / w_i^*
   * Raises underweight assets to water level lambda* without selling overweight assets
   */
  static calculateDCARebalance(
    valuations: ValuationDetail[],
    targetAllocations: TargetAllocationItem[],
    depositAmountCZK: number,
    toleranceBandPercent = 2.5
  ): DCARebalanceResult {
    const totalCurrentNavCZK = valuations.reduce((sum, v) => sum + v.marketValueTarget, 0);
    const postDepositNavCZK = totalCurrentNavCZK + Math.max(0, depositAmountCZK);
    const validPostNav = Math.max(1, postDepositNavCZK);

    // Normalize target weights so sum(w_i) = 1.0
    const rawSumWeights = targetAllocations.reduce((sum, t) => sum + t.targetWeightPercent, 0);
    const normalizedTargets = targetAllocations.map((t) => ({
      ...t,
      normalizedWeight: rawSumWeights > 0 ? (t.targetWeightPercent / rawSumWeights) : 0,
    }));

    const C = Math.max(0, depositAmountCZK);

    // Initial item states
    const itemsWithDrift = normalizedTargets.map((item) => {
      const currentWeight = totalCurrentNavCZK > 0
        ? (item.currentValueCZK / totalCurrentNavCZK) * 100
        : item.targetWeightPercent;
      const drift = currentWeight - item.targetWeightPercent;

      return {
        ...item,
        currentWeightPercent: Math.round(currentWeight * 10) / 10,
        driftPercent: Math.round(drift * 10) / 10,
        allocatedDepositCZK: 0,
        postDepositValueCZK: item.currentValueCZK,
        postDepositWeightPercent: currentWeight,
        postDepositDriftPercent: drift,
      };
    });

    const maxDriftBeforePercent = itemsWithDrift.length > 0
      ? Math.max(...itemsWithDrift.map((t) => Math.abs(t.driftPercent)))
      : 0;

    // Execute Water-Filling if C > 0
    if (C > 0 && itemsWithDrift.length > 0) {
      // Filter items with positive target weight
      const activeCandidates = itemsWithDrift.filter((item) => item.normalizedWeight > 0);

      // Compute normalized capital levels L_i = V_i / w_i^*
      const withLevels = activeCandidates.map((item) => ({
        item,
        L: item.currentValueCZK / item.normalizedWeight,
        V: item.currentValueCZK,
        w: item.normalizedWeight,
      }));

      // Sort by level ascending: lowest level gets water first
      withLevels.sort((a, b) => a.L - b.L);

      let lambdaStar = 0;
      let activeK = 1;

      // Find optimal active set k where lambda_k <= L_{k+1}
      for (let k = 1; k <= withLevels.length; k++) {
        const sumV = withLevels.slice(0, k).reduce((s, x) => s + x.V, 0);
        const sumW = withLevels.slice(0, k).reduce((s, x) => s + x.w, 0);
        const lambdaK = (sumV + C) / sumW;

        if (k === withLevels.length || lambdaK <= withLevels[k].L) {
          lambdaStar = lambdaK;
          activeK = k;
          break;
        }
      }

      // Compute raw continuous allocations a_i = max(0, lambda* * w_i - V_i)
      let allocatedTotal = 0;
      for (let i = 0; i < activeK; i++) {
        const cand = withLevels[i];
        const rawAlloc = Math.max(0, lambdaStar * cand.w - cand.V);
        cand.item.allocatedDepositCZK = Math.round(rawAlloc);
        allocatedTotal += cand.item.allocatedDepositCZK;
      }

      // Handle integer rounding discrepancy (Largest Remainder Hare-Niemeyer)
      const diff = C - allocatedTotal;
      if (diff !== 0 && withLevels.length > 0) {
        // Adjust the asset with highest allocation
        withLevels[0].item.allocatedDepositCZK += diff;
      }
    }

    // Compute post-deposit values and drift
    for (const item of itemsWithDrift) {
      item.postDepositValueCZK = item.currentValueCZK + item.allocatedDepositCZK;
      item.postDepositWeightPercent = Math.round((item.postDepositValueCZK / validPostNav) * 1000) / 10;
      item.postDepositDriftPercent = Math.round((item.postDepositWeightPercent - item.targetWeightPercent) * 10) / 10;
      item.isUnderweight = item.driftPercent < -0.5;
    }

    const maxDriftAfterPercent = itemsWithDrift.length > 0
      ? Math.max(...itemsWithDrift.map((t) => Math.abs(t.postDepositDriftPercent)))
      : 0;

    // Generate order slips for broker execution
    const orders: RebalanceOrderSlip[] = [];
    const ordersByBroker: Record<BrokerId, RebalanceOrderSlip[]> = {
      XTB: [],
      DEGIRO: [],
      IBKR: [],
      PORTU: [],
      GENERIC_CSV: [],
      BANK: [],
      CASH: [],
    };

    for (const target of itemsWithDrift) {
      if (target.allocatedDepositCZK <= 50) continue; // Skip negligible allocations (< 50 CZK)

      const matchingValuations = valuations.filter((v) => {
        return (
          v.holding.clusterId === target.targetId ||
          v.holding.name === target.name ||
          v.holding.normalizedTicker === target.ticker
        );
      });

      matchingValuations.sort((a, b) => b.marketValueTarget - a.marketValueTarget);
      const chosen = matchingValuations[0];

      if (!chosen || chosen.holding.assetClass === 'CASH') {
        continue;
      }

      const brokerId = chosen.holding.brokerId;
      const currency = chosen.instrumentCurrency;
      const priceNative = chosen.currentPriceNative || chosen.holding.currentPrice || 100;
      const rateToCZK = CurrencyService.getRate(currency, 'CZK');

      const allocatedCZK = target.allocatedDepositCZK;
      const allocatedNative = rateToCZK > 0 ? allocatedCZK / rateToCZK : allocatedCZK;

      const isFractional = brokerId !== 'DEGIRO';
      let sharesToBuy = isFractional
        ? Math.round((allocatedNative / priceNative) * 1000) / 1000
        : Math.floor(allocatedNative / priceNative);

      if (sharesToBuy <= 0 && !isFractional) {
        sharesToBuy = 1;
      }

      const orderSlip: RebalanceOrderSlip = {
        id: `order-${chosen.holding.id}`,
        holdingId: chosen.holding.id,
        ticker: chosen.holding.normalizedTicker,
        name: chosen.holding.name,
        isin: chosen.holding.isin,
        brokerId,
        instrumentCurrency: currency,
        currentPriceNative: priceNative,
        allocatedAmountCZK: allocatedCZK,
        allocatedAmountNative: Math.round(allocatedNative * 100) / 100,
        sharesToBuy,
        isFractional,
        postValueCZK: target.postDepositValueCZK,
        postWeightPercent: target.postDepositWeightPercent,
        comment: `Nákup k dorovnání alokace z ${target.currentWeightPercent}% na ${target.postDepositWeightPercent}%`,
      };

      orders.push(orderSlip);
      if (ordersByBroker[brokerId]) {
        ordersByBroker[brokerId].push(orderSlip);
      }
    }

    return {
      depositAmountCZK,
      currentNavCZK: Math.round(totalCurrentNavCZK),
      postDepositNavCZK: Math.round(postDepositNavCZK),
      toleranceBandPercent,
      targetAllocations: itemsWithDrift,
      orders,
      ordersByBroker,
      maxDriftBeforePercent,
      maxDriftAfterPercent,
      unallocatedCashCZK: 0,
    };
  }
}
