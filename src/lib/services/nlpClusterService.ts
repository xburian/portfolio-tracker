import { AutoTagRule, Cluster, Holding } from '@/types/portfolio';
import { db } from '@/lib/db';

const FINANCIAL_ISSUERS = new Set([
  'ishares', 'vanguard', 'spdr', 'invesco', 'amundi', 'xtrackers',
  'wisdomtree', 'lyxor', 'blackrock', 'bnp', 'paribas', 'franklin',
  'templeton', 'dws', 'state', 'street', 'global', 'advisors', 'hsbc'
]);

const STRUCTURAL_STOP_WORDS = new Set([
  'ucits', 'etf', 'etc', 'etn', 'sicav', 'plc', 'fund', 'trust', 'cef',
  'holdings', 'index', 'core', 'prime', 'swap', 'hedged', 'unhedged',
  'acc', 'dist', 'accumulating', 'distributing', 'dr', 'class',
  'usd', 'eur', 'gbp', 'gbx', 'czk', 'chf', 'jpy',
  'daily', '2x', '3x', 'short', 'leveraged', 'series'
]);

// Canonical benchmark dictionary
const CANONICAL_BENCHMARKS: Array<{
  id: string;
  name: string;
  color: string;
  patterns: RegExp[];
}> = [
  {
    id: 'sp500',
    name: 'S&P 500',
    color: '#6366F1', // Indigo
    patterns: [
      /\b(s&p\s*500|sp500|spx|us\s*500|500\s*index)\b/i,
      /^(SXR8|VUAA|VOO|SPY|IVV|CSPX|VUSA)(\.[A-Z]+)?$/i,
    ],
  },
  {
    id: 'all_world',
    name: 'FTSE All-World',
    color: '#06B6D4', // Cyan
    patterns: [
      /\b(all-world|all\s*world|acwi|world\s*all\s*cap|msci\s*world)\b/i,
      /^(VWCE|VWRA|SSAC|ISAC|ACWI|EUNL|IWDA)(\.[A-Z]+)?$/i,
    ],
  },
  {
    id: 'gold',
    name: 'Physical Gold',
    color: '#F59E0B', // Amber
    patterns: [
      /\b(physical\s*gold|gold\s*bullion|etc\s*gold|gold\s*trust|zlato)\b/i,
      /^(IGLN|EGLN|SGLN|4GLD|GLD|IAU)(\.[A-Z]+)?$/i,
    ],
  },
  {
    id: 'czech_stocks',
    name: 'České akcie (PX Index)',
    color: '#10B981', // Emerald
    patterns: [
      /\b(čez|cez|komerční|komercni|moneta|erste|philip\s*morris|colt|komb|rbag)\b/i,
      /^(CEZ1|CEZ|KOMB|MONET|RBAG|TABK|CZG)(\.CZ|\.PR)?$/i,
    ],
  },
  {
    id: 'us_big_tech',
    name: 'US Big Tech & Semis',
    color: '#8B5CF6', // Purple
    patterns: [
      /\b(apple|alphabet|google|microsoft|amazon|meta|nvidia|amd|broadcom|tsmc|asml|crowdstrike|netflix)\b/i,
      /^(AAPL|MSFT|GOOGL|GOOG|AMZN|META|NVDA|AMD|AVGO|TSM|ASML|CRWD|NFLX)(\.[A-Z]+)?$/i,
    ],
  },
];

export class NlpClusterService {
  /**
   * Tokenizes name, strips financial stop words and issuers
   */
  static extractCoreTokens(name: string): string[] {
    let clean = name.toLowerCase()
      .replace(/[()\[\],.\-_/\\+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Canonicalize multi-word phrases before tokenizing
    clean = clean.replace(/\b(s&p\s*500|sp500|s\s*&\s*p\s*500|us\s*500)\b/g, 'sp500');
    clean = clean.replace(/\b(all\s*world|all-world|msci\s*world)\b/g, 'allworld');
    clean = clean.replace(/\b(physical\s*gold|gold\s*bullion)\b/g, 'gold');

    const raw = clean.split(' ');
    const tokens: string[] = [];

    for (const t of raw) {
      if (!t || t.length < 2) continue;
      if (FINANCIAL_ISSUERS.has(t)) continue;
      if (STRUCTURAL_STOP_WORDS.has(t)) continue;
      tokens.push(t);
    }

    return tokens;
  }

  static calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const t of setA) {
      if (setB.has(t)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Classifies a holding using:
   * 1. Stored user rules (highest priority)
   * 2. Canonical benchmark regex
   * 3. NLP Token analysis & Jaccard clustering
   */
  static classifyHolding(
    holding: { rawTicker: string; name: string; isin?: string },
    userRules: AutoTagRule[] = []
  ): { clusterId: string; clusterName: string; tags: string[]; benchmark?: string; color: string } {
    const ticker = holding.rawTicker.toUpperCase();
    const name = holding.name || holding.rawTicker;

    // 1. Check user-defined rules
    for (const rule of userRules) {
      if (rule.matchType === 'EXACT_SYMBOL' && rule.pattern.toUpperCase() === ticker) {
        return {
          clusterId: rule.assignedClusterId,
          clusterName: rule.assignedClusterName,
          tags: rule.assignedTags,
          benchmark: rule.assignedBenchmark,
          color: '#6366F1',
        };
      }
      if (rule.matchType === 'TOKEN_KEYWORD') {
        const kw = rule.pattern.toLowerCase();
        if (ticker.toLowerCase().includes(kw) || name.toLowerCase().includes(kw)) {
          return {
            clusterId: rule.assignedClusterId,
            clusterName: rule.assignedClusterName,
            tags: rule.assignedTags,
            benchmark: rule.assignedBenchmark,
            color: '#6366F1',
          };
        }
      }
      if (rule.matchType === 'REGEX') {
        try {
          const reg = new RegExp(rule.pattern, 'i');
          if (reg.test(ticker) || reg.test(name)) {
            return {
              clusterId: rule.assignedClusterId,
              clusterName: rule.assignedClusterName,
              tags: rule.assignedTags,
              benchmark: rule.assignedBenchmark,
              color: '#6366F1',
            };
          }
        } catch {}
      }
    }

    // 2. Check canonical benchmarks
    for (const bm of CANONICAL_BENCHMARKS) {
      for (const pattern of bm.patterns) {
        if (pattern.test(ticker) || pattern.test(name)) {
          return {
            clusterId: bm.id,
            clusterName: bm.name,
            tags: [bm.name],
            benchmark: bm.name,
            color: bm.color,
          };
        }
      }
    }

    // 3. Fallback: single-instrument cluster
    return {
      clusterId: `cluster_${ticker.replace(/[^A-Z0-9]/g, '_')}`,
      clusterName: name,
      tags: [name],
      color: '#64748B', // Slate
    };
  }

  /**
   * Applies clustering across all holdings and saves rules/clusters to Dexie
   */
  static async autoClusterHoldings(holdings: Holding[]): Promise<{
    clusters: Cluster[];
    updatedHoldings: Holding[];
  }> {
    const userRules = await db.rules.toArray();
    const clustersMap = new Map<string, Cluster>();

    // Seed canonical clusters
    CANONICAL_BENCHMARKS.forEach(bm => {
      clustersMap.set(bm.id, {
        id: bm.id,
        name: bm.name,
        color: bm.color,
      });
    });

    const updatedHoldings: Holding[] = holdings.map(h => {
      const classification = this.classifyHolding(
        { rawTicker: h.rawTicker, name: h.name, isin: h.isin },
        userRules
      );

      if (!clustersMap.has(classification.clusterId)) {
        clustersMap.set(classification.clusterId, {
          id: classification.clusterId,
          name: classification.clusterName,
          color: classification.color,
        });
      }

      return {
        ...h,
        clusterId: classification.clusterId,
        tags: Array.from(new Set([...h.tags, ...classification.tags])),
        benchmark: classification.benchmark || h.benchmark,
      };
    });

    const clustersList = Array.from(clustersMap.values());
    for (const c of clustersList) {
      await db.clusters.put(c);
    }

    return {
      clusters: clustersList,
      updatedHoldings,
    };
  }
}
