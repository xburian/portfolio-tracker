import { describe, it, expect } from 'vitest';
import { NlpClusterService } from '@/lib/services/nlpClusterService';

describe('NLP Cluster Service', () => {
  it('automatically classifies SXR8.DE and VUAA.UK into S&P 500', () => {
    const sxr8 = NlpClusterService.classifyHolding({
      rawTicker: 'SXR8.DE',
      name: 'Core S&P 500 UCITS ETF (Acc)',
    });
    expect(sxr8.clusterId).toBe('sp500');
    expect(sxr8.clusterName).toBe('S&P 500');

    const vuaa = NlpClusterService.classifyHolding({
      rawTicker: 'VUAA.UK',
      name: 'Vanguard S&P 500 UCITS ETF USD',
    });
    expect(vuaa.clusterId).toBe('sp500');
    expect(vuaa.clusterName).toBe('S&P 500');

    const voo = NlpClusterService.classifyHolding({
      rawTicker: 'VOO',
      name: 'Vanguard 500 Index Fund ETF',
    });
    expect(voo.clusterId).toBe('sp500');
  });

  it('automatically classifies VWCE and VWRA into FTSE All-World', () => {
    const vwce = NlpClusterService.classifyHolding({
      rawTicker: 'VWCE.DE',
      name: 'Vanguard FTSE All-World UCITS ETF (USD) Accumulating',
    });
    expect(vwce.clusterId).toBe('all_world');
    expect(vwce.clusterName).toBe('FTSE All-World');

    const vwra = NlpClusterService.classifyHolding({
      rawTicker: 'VWRA.UK',
      name: 'Vanguard FTSE All-World UCITS ETF USD Acc',
    });
    expect(vwra.clusterId).toBe('all_world');
  });

  it('automatically classifies physical gold instruments', () => {
    const igln = NlpClusterService.classifyHolding({
      rawTicker: 'IGLN.UK',
      name: 'iShares Physical Gold ETC',
    });
    expect(igln.clusterId).toBe('gold');

    const egln = NlpClusterService.classifyHolding({
      rawTicker: 'EGLN.UK',
      name: 'Physical Gold ETC',
    });
    expect(egln.clusterId).toBe('gold');
  });

  it('automatically classifies Czech stocks', () => {
    const cez = NlpClusterService.classifyHolding({
      rawTicker: 'CEZ1.CZ',
      name: 'ČEZ',
    });
    expect(cez.clusterId).toBe('czech_stocks');

    const monet = NlpClusterService.classifyHolding({
      rawTicker: 'MONET.CZ',
      name: 'Moneta Money Bank',
    });
    expect(monet.clusterId).toBe('czech_stocks');
  });

  it('extracts core tokens cleanly without issuer or structural noise', () => {
    const tokens = NlpClusterService.extractCoreTokens('iShares Core S&P 500 UCITS ETF (Acc) EUR');
    expect(tokens).toContain('sp500');
    expect(tokens).not.toContain('ishares');
    expect(tokens).not.toContain('ucits');
    expect(tokens).not.toContain('etf');
    expect(tokens).not.toContain('eur');
  });
});
