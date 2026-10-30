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
