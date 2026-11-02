import { BrokerId, CurrencyCode } from './portfolio';

export interface TargetAllocationItem {
  id: string;
  targetType: 'CLUSTER' | 'HOLDING';
  targetId: string;
  name: string;
  ticker?: string;
  brokerId?: BrokerId;
  currency?: CurrencyCode;

  targetWeightPercent: number; // e.g. 70.0 (%)
  currentValueCZK: number;
  currentWeightPercent: number; // e.g. 64.2 (%)
  driftPercent: number; // currentWeight - targetWeight (negative means underweight)
  isUnderweight: boolean;

  allocatedDepositCZK: number;
  postDepositValueCZK: number;
  postDepositWeightPercent: number;
  postDepositDriftPercent: number;
}

export interface RebalanceOrderSlip {
  id: string;
  holdingId: string;
  ticker: string;
  name: string;
  isin?: string;
  brokerId: BrokerId;
  instrumentCurrency: CurrencyCode;

  currentPriceNative: number;
  allocatedAmountCZK: number;
  allocatedAmountNative: number;
  sharesToBuy: number;
  isFractional: boolean;

  postValueCZK: number;
  postWeightPercent: number;
  comment?: string;
}

export interface DCARebalanceResult {
  depositAmountCZK: number;
  currentNavCZK: number;
  postDepositNavCZK: number;
  toleranceBandPercent: number; // default 2.5%

  targetAllocations: TargetAllocationItem[];
  orders: RebalanceOrderSlip[];
  ordersByBroker: Record<BrokerId, RebalanceOrderSlip[]>;

  maxDriftBeforePercent: number;
  maxDriftAfterPercent: number;
  unallocatedCashCZK: number;
}

export interface RebalancePreset {
  id: string;
  name: string;
  description: string;
  targets: Array<{ targetName: string; weightPercent: number }>;
}
