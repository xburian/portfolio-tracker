import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../server/storage/memoryStorage';
import { RedisStorage } from '../server/storage/redisStorage';
import { JwtService } from '../server/auth/jwtService';
import { AuthService } from '../server/auth/authService';
import { User } from '../server/auth/types';

describe('Storage Abstraction (In-Memory & Redis)', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('stores and retrieves key-value pairs', async () => {
    await storage.set('test:key', 'hello-world');
    expect(await storage.get('test:key')).toBe('hello-world');
    expect(await storage.has('test:key')).toBe(true);

    await storage.del('test:key');
    expect(await storage.get('test:key')).toBeNull();
    expect(await storage.has('test:key')).toBe(false);
  });

  it('handles TTL expiration properly', async () => {
    // Set with 1 second TTL
    await storage.set('temp:key', 'expires-fast', 1);
    expect(await storage.get('temp:key')).toBe('expires-fast');

    // Wait 1.1s
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await storage.get('temp:key')).toBeNull();
  });

  it('filters keys by pattern correctly', async () => {
    await storage.set('user:1', 'Alice');
    await storage.set('user:2', 'Bob');
    await storage.set('session:1', 'token-abc');

    const userKeys = await storage.keys('user:*');
    expect(userKeys).toContain('user:1');
    expect(userKeys).toContain('user:2');
    expect(userKeys).not.toContain('session:1');
  });

  it('reports memory storage status', async () => {
    await storage.set('key1', 'val1');
    const status = await storage.getStatus();
    expect(status.type).toBe('memory');
    expect(status.connected).toBe(true);
    expect(status.keysCount).toBeGreaterThanOrEqual(1);
  });

  it('gracefully handles unreachable Redis connection without crashing', async () => {
    // Connect to invalid port to test error handling
    const redis = new RedisStorage('redis://127.0.0.1:54321', {
      connectTimeout: 500,
      maxRetriesPerRequest: 1,
    });
    const connected = await redis.init();
    expect(connected).toBe(false);

    const status = await redis.getStatus();
    expect(status.type).toBe('redis');
    expect(status.connected).toBe(false);

    await redis.disconnect();
  });
});

describe('JWT Access & Refresh Token Service', () => {
  const dummyUser: User = {
    id: 'user-uuid-1234',
    email: 'lukas@burian.cz',
    name: 'Lukáš Burian',
    passwordHash: 'dummy-hash',
    role: 'admin',
    profileId: 'profile_lukas_default',
    createdAt: new Date().toISOString(),
  };

  it('generates and verifies a valid JWT Access Token', async () => {
    const token = await JwtService.generateAccessToken(dummyUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await JwtService.verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(dummyUser.id);
    expect(payload?.email).toBe(dummyUser.email);
    expect(payload?.role).toBe('admin');
    expect(payload?.profileId).toBe('profile_lukas_default');
  });

  it('rejects tampered or malformed tokens', async () => {
    const token = await JwtService.generateAccessToken(dummyUser);
    const tampered = token.slice(0, -6) + 'abcdef';
    const payload = await JwtService.verifyAccessToken(tampered);
    expect(payload).toBeNull();

    const garbage = await JwtService.verifyAccessToken('invalid.token.here');
    expect(garbage).toBeNull();
  });

  it('generates random refresh tokens and extracts token ID', () => {
    const { token, record } = JwtService.generateRefreshTokenRecord(dummyUser.id, 'Mozilla/5.0', '127.0.0.1');
    expect(token.startsWith('rt_')).toBe(true);
    expect(record.userId).toBe(dummyUser.id);
    expect(record.familyId).toBeDefined();

    const extractedId = JwtService.extractTokenId(token);
    expect(extractedId).toBe(record.tokenId);
  });
});

describe('Auth Service (Password Hashing, Registration, Login & Rotation)', () => {
  let storage: MemoryStorage;
  let authService: AuthService;

  beforeEach(() => {
    storage = new MemoryStorage();
    authService = new AuthService(storage);
  });

  it('hashes and verifies passwords securely', async () => {
    const pwd = 'MojeBezpecneHeslo2026!';
    const hash = await AuthService.hashPassword(pwd);
    expect(hash).not.toBe(pwd);

    const valid = await AuthService.verifyPassword(pwd, hash);
    expect(valid).toBe(true);

    const invalid = await AuthService.verifyPassword('SpatneHeslo', hash);
    expect(invalid).toBe(false);
  });

  it('registers a new user and returns JWT access + refresh tokens', async () => {
    const res = await authService.register({
      email: 'investor@seznam.cz',
      password: 'investorPassword123',
      name: 'Petr Novák',
      role: 'user',
    });

    expect(res.user.email).toBe('investor@seznam.cz');
    expect(res.user.name).toBe('Petr Novák');
    expect(res.tokens.accessToken).toBeDefined();
    expect(res.tokens.refreshToken.startsWith('rt_')).toBe(true);
    expect(res.tokens.expiresIn).toBe(900); // 15m

    // Ensure duplicate email fails
    await expect(
      authService.register({
        email: 'investor@seznam.cz',
        password: 'differentPassword',
      })
    ).rejects.toThrow('Uživatel s tímto emailem již existuje');
  });

  it('logs in existing user and rotates refresh token', async () => {
    // 1. Register
    const reg = await authService.register({
      email: 'lukas@burian.cz',
      password: 'password123',
      name: 'Lukáš',
    });

    // 2. Login
    const login = await authService.login({
      email: 'lukas@burian.cz',
      password: 'password123',
    });

    expect(login.user.id).toBe(reg.user.id);
    expect(login.tokens.accessToken).toBeDefined();
    expect(login.tokens.refreshToken).toBeDefined();

    // 3. Rotate Refresh Token
    const rotated = await authService.rotateRefreshToken(login.tokens.refreshToken);
    expect(rotated.tokens.accessToken).toBeDefined();
    expect(rotated.tokens.refreshToken).not.toBe(login.tokens.refreshToken);

    // 4. Token Reuse Detection: Attempting to reuse the old refresh token must trigger security alert
    await expect(authService.rotateRefreshToken(login.tokens.refreshToken)).rejects.toThrow(
      'Detekováno zneužití tokenu'
    );
  });

  it('logs out and revokes refresh token', async () => {
    const reg = await authService.register({
      email: 'logout@test.cz',
      password: 'password123',
    });

    // Logout
    await authService.logout(reg.tokens.refreshToken);

    // Refreshing should now fail
    await expect(authService.rotateRefreshToken(reg.tokens.refreshToken)).rejects.toThrow(
      'Refresh token nenalezen nebo vypršel'
    );
  });
});

describe('Portfolio & Budget Synchronization in In-Memory / Redis Storage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('persists complete portfolio, dividend and budget entities in In-Memory DB', async () => {
    const userId = 'user_lukas_test';

    const dummyHoldings = [
      { id: 'h1', ticker: 'AAPL', shares: 10, currency: 'USD' },
      { id: 'h2', ticker: 'SXR8.DE', shares: 5, currency: 'EUR' },
    ];
    const dummyDividends = [
      { id: 'div1', ticker: 'AAPL', netAmountCZK: 350, currency: 'USD' },
    ];
    const dummySalary = {
      profileId: 'prof1',
      baseMonthlyNetSalaryCZK: 85000,
      paydayDayOfMonth: 15,
      annualIncreasePercentage: 5,
    };
    const dummyExpenses = [
      { id: 'exp1', name: 'Nájem', monthlyAmountCZK: 25000 },
      { id: 'exp2', name: 'Jídlo', monthlyAmountCZK: 12000 },
    ];

    // Store into in-memory storage
    await storage.set(`portfolio:${userId}:holdings`, JSON.stringify(dummyHoldings));
    await storage.set(`portfolio:${userId}:dividends`, JSON.stringify(dummyDividends));
    await storage.set(`portfolio:${userId}:salaryConfigs`, JSON.stringify([dummySalary]));
    await storage.set(`portfolio:${userId}:expenseCategories`, JSON.stringify(dummyExpenses));
    await storage.set(`portfolio:${userId}:meta`, JSON.stringify({
      syncedAt: new Date().toISOString(),
      counts: { holdings: 2, dividends: 1, salaryConfigs: 1, expenseCategories: 2 },
    }));

    // Verify retrieval
    const retrievedHoldings = JSON.parse((await storage.get(`portfolio:${userId}:holdings`)) || '[]');
    expect(retrievedHoldings).toHaveLength(2);
    expect(retrievedHoldings[0].ticker).toBe('AAPL');

    const retrievedDividends = JSON.parse((await storage.get(`portfolio:${userId}:dividends`)) || '[]');
    expect(retrievedDividends[0].netAmountCZK).toBe(350);

    const retrievedSalary = JSON.parse((await storage.get(`portfolio:${userId}:salaryConfigs`)) || '[]');
    expect(retrievedSalary[0].baseMonthlyNetSalaryCZK).toBe(85000);

    const retrievedExpenses = JSON.parse((await storage.get(`portfolio:${userId}:expenseCategories`)) || '[]');
    expect(retrievedExpenses).toHaveLength(2);

    // Verify key search and isolation
    const keys = await storage.keys(`portfolio:${userId}:*`);
    expect(keys).toHaveLength(5);
    expect(keys).toContain(`portfolio:${userId}:holdings`);
    expect(keys).toContain(`portfolio:${userId}:dividends`);
    expect(keys).toContain(`portfolio:${userId}:salaryConfigs`);
    expect(keys).toContain(`portfolio:${userId}:expenseCategories`);
    expect(keys).toContain(`portfolio:${userId}:meta`);
  });

  it('guarantees strict multi-tenant isolation between different users in In-Memory DB', async () => {
    const userA = 'user_alice';
    const userB = 'user_bob';

    await storage.set(`portfolio:${userA}:holdings`, JSON.stringify([{ id: 'alice_h1' }]));
    await storage.set(`portfolio:${userB}:holdings`, JSON.stringify([{ id: 'bob_h1' }]));

    const aliceHoldings = JSON.parse((await storage.get(`portfolio:${userA}:holdings`)) || '[]');
    const bobHoldings = JSON.parse((await storage.get(`portfolio:${userB}:holdings`)) || '[]');

    expect(aliceHoldings[0].id).toBe('alice_h1');
    expect(bobHoldings[0].id).toBe('bob_h1');

    // Deleting userA's portfolio must not affect userB
    const userAKeys = await storage.keys(`portfolio:${userA}:*`);
    for (const k of userAKeys) {
      await storage.del(k);
    }

    expect(await storage.get(`portfolio:${userA}:holdings`)).toBeNull();
    expect(await storage.get(`portfolio:${userB}:holdings`)).not.toBeNull();
  });

  it('correctly tracks storage status with active keys count in In-Memory DB', async () => {
    const initialStatus = await storage.getStatus();
    const initialCount = initialStatus.keysCount || 0;

    await storage.set('portfolio:default_user:accounts', JSON.stringify([{ id: 'acc1' }]));
    await storage.set('portfolio:default_user:holdings', JSON.stringify([{ id: 'h1' }]));
    await storage.set('portfolio:default_user:lots', JSON.stringify([{ id: 'l1' }]));

    const updatedStatus = await storage.getStatus();
    expect(updatedStatus.keysCount).toBe(initialCount + 3);
  });
});
