export interface RebalanceTarget {
  id: string;
  name: string;
  currentValue: number;
  targetWeight: number; // e.g. 0.5 for 50%
}

export interface RebalanceAllocation {
  id: string;
  name: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  cashToAdd: number;
  postValue: number;
  postWeight: number;
}

export class RebalanceService {
  /**
   * Calculates how to distribute new cash inflow strictly to underweight positions
   * using the KKT Water-Filling algorithm (no selling permitted).
   */
  static calculateBuyOnly(
    targets: RebalanceTarget[],
    inflowCash: number
  ): RebalanceAllocation[] {
    const currentTotal = targets.reduce((sum, t) => sum + t.currentValue, 0);
    const newTotal = currentTotal + inflowCash;

    if (newTotal <= 0) return [];

    let active = [...targets];
    let cashRemaining = inflowCash;
    const allocation: Record<string, number> = {};
    targets.forEach(t => (allocation[t.id] = 0));

    // Iteratively prune assets whose current value is already above the water level
    while (active.length > 0) {
      const activeCurrentVal = active.reduce((sum, a) => sum + a.currentValue, 0);
      const activeTargetWeight = active.reduce((sum, a) => sum + a.targetWeight, 0);

      if (activeTargetWeight <= 0) break;

      const waterLevel = (activeCurrentVal + cashRemaining) / activeTargetWeight;
      const overweightInActive = active.filter(a => a.currentValue >= a.targetWeight * waterLevel);

      if (overweightInActive.length === 0) {
        // Equilibrium reached: allocate cash to all active assets
        for (const a of active) {
          const targetShare = a.targetWeight * waterLevel;
          const add = Math.max(0, targetShare - a.currentValue);
          allocation[a.id] = add;
        }
        break;
      } else {
        // Remove over-allocated assets and re-solve
        active = active.filter(a => a.currentValue < a.targetWeight * waterLevel);
      }
    }

    return targets.map(t => {
      const add = allocation[t.id] || 0;
      const postVal = t.currentValue + add;
      return {
        id: t.id,
        name: t.name,
        currentValue: Math.round(t.currentValue * 100) / 100,
        currentWeight: currentTotal > 0 ? t.currentValue / currentTotal : 0,
        targetWeight: t.targetWeight,
        cashToAdd: Math.round(add * 100) / 100,
        postValue: Math.round(postVal * 100) / 100,
        postWeight: newTotal > 0 ? postVal / newTotal : 0,
      };
    });
  }
}
