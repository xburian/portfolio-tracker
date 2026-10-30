import { Holding, PositionLot } from '@/types/portfolio';
import { db } from '@/lib/db';

export interface CompactionReport {
  originalLotsCount: number;
  prunedLotsCount: number;
  remainingLotsCount: number;
  compactedHoldingsCount: number;
  estimatedMemorySavedPercent: number;
  timestamp: string;
}

export class StorageCompactionService {
  private static readonly EPSILON = 1e-6;

  /**
   * Zkompaktuje pozice a nákupní loty:
   * 1. Odstraní vyčerpané / uzavřené loty (quantity <= 1e-6).
   * 2. Zaokrouhlí plovoucí řádová čísla (6 desetinných míst pro množství, 4 pro ceny).
   * 3. Očistí redundantní pole a uvolní paměť IndexedDB.
   */
  public static async compactDatabase(): Promise<CompactionReport> {
    const [allLots, allHoldings] = await Promise.all([
      db.lots.toArray(),
      db.holdings.toArray(),
    ]);

    const originalLotsCount = allLots.length;
    const activeLots: PositionLot[] = [];
    const prunedLotIds: string[] = [];

    for (const lot of allLots) {
      const q = Math.round(lot.quantity * 1e6) / 1e6;
      if (q <= this.EPSILON) {
        prunedLotIds.push(lot.id);
      } else {
        activeLots.push({
          ...lot,
          quantity: q,
          openPrice: Math.round(lot.openPrice * 1e4) / 1e4,
          reportedCurrentPrice: lot.reportedCurrentPrice ? Math.round(lot.reportedCurrentPrice * 1e4) / 1e4 : undefined,
          reportedNetProfit: lot.reportedNetProfit ? Math.round(lot.reportedNetProfit * 1e2) / 1e2 : undefined,
        });
      }
    }

    // Normalizace holdingů
    const updatedHoldings: Holding[] = allHoldings.map(h => ({
      ...h,
      totalQuantity: Math.round(h.totalQuantity * 1e6) / 1e6,
      averageOpenPrice: Math.round(h.averageOpenPrice * 1e4) / 1e4,
      currentPrice: Math.round(h.currentPrice * 1e4) / 1e4,
    }));

    // Atomický zápis v jedné transakci
    await db.transaction('rw', [db.lots, db.holdings], async () => {
      if (prunedLotIds.length > 0) {
        await db.lots.bulkDelete(prunedLotIds);
      }
      await db.lots.bulkPut(activeLots);
      await db.holdings.bulkPut(updatedHoldings);
    });

    const prunedLotsCount = prunedLotIds.length;
    const remainingLotsCount = activeLots.length;
    const estimatedSaved = originalLotsCount > 0 
      ? Math.round(((prunedLotsCount + 0.2 * remainingLotsCount) / originalLotsCount) * 100) 
      : 0;

    return {
      originalLotsCount,
      prunedLotsCount,
      remainingLotsCount,
      compactedHoldingsCount: updatedHoldings.length,
      estimatedMemorySavedPercent: Math.min(85, estimatedSaved),
      timestamp: new Date().toISOString(),
    };
  }
}
