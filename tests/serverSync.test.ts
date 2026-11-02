import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../server/index';
import { JwtService } from '../server/auth/jwtService';
import { User } from '../server/auth/types';

describe('Server Storage & Portfolio Sync Integration Endpoints', () => {
  const dummyUser: User = {
    id: 'user_sync_test_999',
    email: 'sync_test@domain.cz',
    name: 'Sync Tester',
    passwordHash: 'dummy',
    role: 'user',
    profileId: 'prof_sync',
    createdAt: new Date().toISOString(),
  };

  let authToken: string;

  beforeEach(async () => {
    authToken = await JwtService.generateAccessToken(dummyUser);
  });

  it('successfully persists portfolio and budget data via POST /api/sync for default_user', async () => {
    const payload = {
      holdings: [
        { id: 'h1', ticker: 'VUAA.UK', shares: 50, avgCost: 85, currency: 'USD' },
      ],
      accounts: [
        { id: 'acc1', name: 'XTB USD', brokerId: 'XTB', baseCurrency: 'USD' },
      ],
      dividends: [
        { id: 'div1', ticker: 'VUAA.UK', grossAmount: 120, currency: 'USD' },
      ],
      salaryConfigs: [
        { profileId: 'default', baseMonthlyNetSalaryCZK: 95000, paydayDayOfMonth: 15 },
      ],
      expenseCategories: [
        { id: 'exp1', name: 'Hypotéka', monthlyAmountCZK: 30000, isEssential: true },
      ],
    };

    const req = new Request('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await server.fetch(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe('default_user');
    expect(json.counts.holdings).toBe(1);
    expect(json.counts.accounts).toBe(1);
    expect(json.counts.dividends).toBe(1);
    expect(json.counts.salaryConfigs).toBe(1);
    expect(json.counts.expenseCategories).toBe(1);

    // Retrieve via GET /api/sync
    const getReq = new Request('http://localhost:3000/api/sync', {
      method: 'GET',
    });
    const getRes = await server.fetch(getReq);
    expect(getRes.status).toBe(200);

    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.hasData).toBe(true);
    expect(getJson.data.holdings).toHaveLength(1);
    expect(getJson.data.holdings[0].ticker).toBe('VUAA.UK');
    expect(getJson.data.accounts[0].brokerId).toBe('XTB');
    expect(getJson.data.dividends[0].grossAmount).toBe(120);
    expect(getJson.data.salaryConfigs[0].baseMonthlyNetSalaryCZK).toBe(95000);
    expect(getJson.data.expenseCategories[0].name).toBe('Hypotéka');
  });

  it('synchronizes portfolio under authenticated user ID with JWT Bearer Token', async () => {
    const payload = {
      holdings: [
        { id: 'auth_h1', ticker: 'BRKB.US', shares: 15, currency: 'USD' },
      ],
    };

    const postReq = new Request('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const postRes = await server.fetch(postReq);
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.userId).toBe(dummyUser.id);

    // Fetch for authenticated user
    const getReq = new Request('http://localhost:3000/api/sync', {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const getRes = await server.fetch(getReq);
    const getJson = await getRes.json();
    expect(getJson.userId).toBe(dummyUser.id);
    expect(getJson.data.holdings[0].ticker).toBe('BRKB.US');

    // Clean up via DELETE /api/sync
    const delReq = new Request('http://localhost:3000/api/sync', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const delRes = await server.fetch(delReq);
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.deletedKeysCount).toBeGreaterThan(0);

    // After deletion, data should be empty
    const verifyReq = new Request('http://localhost:3000/api/sync', {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const verifyRes = await server.fetch(verifyReq);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.hasData).toBe(false);
  });

  it('exposes detailed diagnostics and key counts via GET /api/storage/inspect and GET /api/health', async () => {
    // 1. Inspect endpoint
    const inspectReq = new Request('http://localhost:3000/api/storage/inspect', { method: 'GET' });
    const inspectRes = await server.fetch(inspectReq);
    expect(inspectRes.status).toBe(200);

    const inspectJson = await inspectRes.json();
    expect(inspectJson.storage.type).toBe('memory');
    expect(inspectJson.storage.connected).toBe(true);
    expect(inspectJson.totalKeys).toBeGreaterThanOrEqual(1);
    expect(inspectJson.entityBreakdown).toBeDefined();

    // 2. Health endpoint
    const healthReq = new Request('http://localhost:3000/api/health', { method: 'GET' });
    const healthRes = await server.fetch(healthReq);
    expect(healthRes.status).toBe(200);

    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('healthy');
    expect(healthJson.storage.type).toBe('memory');
    expect(healthJson.totalKeys).toBeGreaterThanOrEqual(1);
  });
});
