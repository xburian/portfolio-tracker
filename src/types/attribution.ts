import { CurrencyCode } from './portfolio';

export interface HoldingDailyChange {
  holdingId: string;
  normalizedTicker: string;
  name: string;
  currentPrice: number;
  previousClosePrice: number;
  dailyChangePrice: number;           // P_t - P_{t-1}
  dailyChangePercent: number;         // ((P_t - P_{t-1}) / P_{t-1}) * 100
  dailyGainCZK: number;               // Q * (P_t - P_{t-1}) * FX_CZK
  totalValueCZK: number;
  instrumentCurrency: CurrencyCode;
}

export interface CurrencyAttributionBreakdown {
  currency: CurrencyCode;             // USD, EUR, CZK, GBP
  totalValueCZK: number;              // Tržní hodnota koše v CZK
  weightPercent: number;              // Váha v portfoliu
  totalGainCZK: number;               // Celkový zisk v CZK
  totalGainPercent: number;           // Celkový zisk v %
  pureAssetGainCZK: number;           // Pohyb ceny podkladových aktiv: Q * (P_t - P_avg) * FX_avg
  pureFxGainCZK: number;              // Pohyb kurzu měny: Q * P_avg * (FX_t - FX_avg)
  crossTermCZK: number;               // Interakce: Q * (P_t - P_avg) * (FX_t - FX_avg)
  dailyGainCZK: number;               // Dnešní přírůstek v CZK
  dailyGainPercent: number;           // Dnešní % změna
}
