import { AssetClass, CurrencyCode, ValuationDetail } from '@/types/portfolio';

export interface HierarchyNode {
  id: string;
  name: string;
  level: 'ROOT' | 'ASSET_CLASS' | 'THEME' | 'BENCHMARK' | 'POSITION';
  marketValueTarget: number;
  costBasisTarget: number;
  unrealizedProfitTarget: number;
  unrealizedProfitPercent: number;
  weightInPortfolio: number;
  weightInParent: number;
  color?: string;
  children: HierarchyNode[];
  leaf?: ValuationDetail;
}

export class HierarchyService {
  static buildTree(valuations: ValuationDetail[], targetCurrency: CurrencyCode): HierarchyNode {
    const totalMv = valuations.reduce((acc, v) => acc + v.marketValueTarget, 0);

    // Grouping structure: AssetClass -> Benchmark/Cluster -> Items
    const classMap = new Map<AssetClass, Map<string, ValuationDetail[]>>();

    for (const v of valuations) {
      const ac = v.holding.assetClass || 'EQUITY';
      const bm = v.holding.benchmark || v.holding.tags[0] || v.holding.name;

      if (!classMap.has(ac)) {
        classMap.set(ac, new Map());
      }
      const bmMap = classMap.get(ac)!;
      if (!bmMap.has(bm)) {
        bmMap.set(bm, []);
      }
      bmMap.get(bm)!.push(v);
    }

    const root: HierarchyNode = {
      id: 'root',
      name: `Portfolio (${targetCurrency})`,
      level: 'ROOT',
      marketValueTarget: totalMv,
      costBasisTarget: valuations.reduce((acc, v) => acc + v.costBasisTarget, 0),
      unrealizedProfitTarget: valuations.reduce((acc, v) => acc + v.unrealizedProfitTarget, 0),
      unrealizedProfitPercent: 0,
      weightInPortfolio: 1.0,
      weightInParent: 1.0,
      children: [],
    };

    root.unrealizedProfitPercent = root.costBasisTarget > 0
      ? (root.unrealizedProfitTarget / root.costBasisTarget) * 100
      : 0;

    for (const [ac, bmMap] of classMap.entries()) {
      const classNode: HierarchyNode = {
        id: `class_${ac}`,
        name: formatAssetClassName(ac),
        level: 'ASSET_CLASS',
        marketValueTarget: 0,
        costBasisTarget: 0,
        unrealizedProfitTarget: 0,
        unrealizedProfitPercent: 0,
        weightInPortfolio: 0,
        weightInParent: 0,
        children: [],
      };

      for (const [bm, items] of bmMap.entries()) {
        const bmMv = items.reduce((acc, i) => acc + i.marketValueTarget, 0);
        const bmCb = items.reduce((acc, i) => acc + i.costBasisTarget, 0);
        const bmPl = items.reduce((acc, i) => acc + i.unrealizedProfitTarget, 0);

        const bmNode: HierarchyNode = {
          id: `bm_${bm}`,
          name: bm,
          level: 'BENCHMARK',
          marketValueTarget: bmMv,
          costBasisTarget: bmCb,
          unrealizedProfitTarget: bmPl,
          unrealizedProfitPercent: bmCb > 0 ? (bmPl / bmCb) * 100 : 0,
          weightInPortfolio: totalMv > 0 ? bmMv / totalMv : 0,
          weightInParent: 0,
          children: items.map(i => ({
            id: `pos_${i.holding.id}`,
            name: `${i.holding.name} (${i.holding.rawTicker})`,
            level: 'POSITION',
            marketValueTarget: i.marketValueTarget,
            costBasisTarget: i.costBasisTarget,
            unrealizedProfitTarget: i.unrealizedProfitTarget,
            unrealizedProfitPercent: i.unrealizedProfitPercent,
            weightInPortfolio: totalMv > 0 ? i.marketValueTarget / totalMv : 0,
            weightInParent: bmMv > 0 ? i.marketValueTarget / bmMv : 0,
            children: [],
            leaf: i,
          })),
        };

        classNode.children.push(bmNode);
      }

      // Roll up class node metrics
      classNode.marketValueTarget = classNode.children.reduce((acc, c) => acc + c.marketValueTarget, 0);
      classNode.costBasisTarget = classNode.children.reduce((acc, c) => acc + c.costBasisTarget, 0);
      classNode.unrealizedProfitTarget = classNode.children.reduce((acc, c) => acc + c.unrealizedProfitTarget, 0);
      classNode.unrealizedProfitPercent = classNode.costBasisTarget > 0
        ? (classNode.unrealizedProfitTarget / classNode.costBasisTarget) * 100
        : 0;
      classNode.weightInPortfolio = totalMv > 0 ? classNode.marketValueTarget / totalMv : 0;
      classNode.weightInParent = classNode.weightInPortfolio;

      // Update benchmark node weightInParent
      classNode.children.forEach(bm => {
        bm.weightInParent = classNode.marketValueTarget > 0 ? bm.marketValueTarget / classNode.marketValueTarget : 0;
      });

      root.children.push(classNode);
    }

    return root;
  }
}

function formatAssetClassName(ac: AssetClass): string {
  switch (ac) {
    case 'ETF': return 'ETF fondy';
    case 'EQUITY': return 'Akcie';
    case 'COMMODITY': return 'Komodity & Zlato';
    case 'BOND': return 'Dluhopisy';
    case 'CRYPTO': return 'Krypto';
    case 'CASH': return 'Hotovost';
    default: return 'Ostatní';
  }
}
