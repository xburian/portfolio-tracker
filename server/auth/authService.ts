import { StorageAdapter } from '../storage/storageAdapter';
import { getStorage } from '../storage';
import { JwtService, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY_SECONDS } from './jwtService';
import { AuthTokens, LoginDto, RegisterDto, User, UserPublic, RefreshTokenRecord } from './types';

export class AuthService {
  private storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage || getStorage();
  }

  static async hashPassword(password: string): Promise<string> {
    if (typeof Bun !== 'undefined' && Bun.password) {
      try {
        return await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
      } catch {
        // fallback
      }
    }

    // Portable Web Crypto PBKDF2 fallback
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', key);
    const hashHex = Array.from(new Uint8Array(exported))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `pbkdf2:${saltHex}:${hashHex}`;
  }

  static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length < 3) return false;
      const salt = new Uint8Array(parts[1].match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
      const expectedHash = parts[2];
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', key);
      const hashHex = Array.from(new Uint8Array(exported))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hashHex === expectedHash;
    }

    if (typeof Bun !== 'undefined' && Bun.password) {
      try {
        return await Bun.password.verify(password, storedHash);
      } catch {
        return false;
      }
    }

    return false;
  }

  toPublicUser(user: User): UserPublic {
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const userId = await this.storage.get(`user:email:${normalizedEmail}`);
    if (!userId) return null;
    return await this.getUserById(userId);
  }

  async getUserById(userId: string): Promise<User | null> {
    const raw = await this.storage.get(`user:${userId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  async register(dto: RegisterDto): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Neplatná emailová adresa');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new Error('Heslo musí mít alespoň 6 znaků');
    }

    const existing = await this.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('Uživatel s tímto emailem již existuje');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await AuthService.hashPassword(dto.password);
    const profileId = dto.profileId || `profile_${userId.slice(0, 8)}`;

    const user: User = {
      id: userId,
      email: normalizedEmail,
      name: dto.name || normalizedEmail.split('@')[0],
      passwordHash,
      role: dto.role || 'user',
      profileId,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Store user data and email index
    await this.storage.set(`user:${user.id}`, JSON.stringify(user));
    await this.storage.set(`user:email:${normalizedEmail}`, user.id);

    // Issue tokens
    const accessToken = await JwtService.generateAccessToken(user);
    const { token: refreshToken, record: refreshRecord } = JwtService.generateRefreshTokenRecord(user.id);

    // Save refresh token record
    await this.storage.set(
      `refresh_token:${refreshRecord.tokenId}`,
      JSON.stringify(refreshRecord),
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: this.toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      },
    };
  }

  async login(
    dto: LoginDto,
    meta?: { userAgent?: string; ip?: string }
  ): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw new Error('Nesprávný email nebo heslo');
    }

    const isValid = await AuthService.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Nesprávný email nebo heslo');
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    await this.storage.set(`user:${user.id}`, JSON.stringify(user));

    // Generate tokens
    const accessToken = await JwtService.generateAccessToken(user);
    const { token: refreshToken, record: refreshRecord } = JwtService.generateRefreshTokenRecord(
      user.id,
      meta?.userAgent,
      meta?.ip
    );

    await this.storage.set(
      `refresh_token:${refreshRecord.tokenId}`,
      JSON.stringify(refreshRecord),
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: this.toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      },
    };
  }

  /**
   * Refresh Token Rotation with Reuse Detection
   */
  async rotateRefreshToken(
    refreshTokenString: string,
    meta?: { userAgent?: string; ip?: string }
  ): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const tokenId = JwtService.extractTokenId(refreshTokenString);
    if (!tokenId) {
      throw new Error('Neplatný refresh token');
    }

    const rawRecord = await this.storage.get(`refresh_token:${tokenId}`);
    if (!rawRecord) {
      throw new Error('Refresh token nenalezen nebo vypršel');
    }

    const record = JSON.parse(rawRecord) as RefreshTokenRecord;

    // Check expiration
    if (record.expiresAt <= Date.now()) {
      await this.storage.del(`refresh_token:${tokenId}`);
      throw new Error('Refresh token vypršel');
    }

    // Token Reuse Detection: if this token was already revoked, someone is reusing an old token!
    if (record.isRevoked) {
      console.warn(`[Security Alert] Refresh token reuse detected for family ${record.familyId}, userId: ${record.userId}`);
      // Invalidate all tokens for this family
      const familyKeys = await this.storage.keys('refresh_token:*');
      for (const k of familyKeys) {
        const val = await this.storage.get(k);
        if (val) {
          try {
            const parsed = JSON.parse(val) as RefreshTokenRecord;
            if (parsed.familyId === record.familyId) {
              await this.storage.del(k);
            }
          } catch {
            // ignore
          }
        }
      }
      throw new Error('Detekováno zneužití tokenu. Relace byla z bezpečnostních důvodů ukončena.');
    }

    const user = await this.getUserById(record.userId);
    if (!user) {
      throw new Error('Uživatel již neexistuje');
    }

    // Invalidate the old refresh token (keep short grace period in store to detect reuse)
    record.isRevoked = true;
    await this.storage.set(`refresh_token:${tokenId}`, JSON.stringify(record), 60);

    // Issue rotated token family member
    const accessToken = await JwtService.generateAccessToken(user);
    const { token: newRefreshToken, record: newRefreshRecord } = JwtService.generateRefreshTokenRecord(
      user.id,
      meta?.userAgent || record.userAgent,
      meta?.ip || record.ip,
      record.familyId
    );

    await this.storage.set(
      `refresh_token:${newRefreshRecord.tokenId}`,
      JSON.stringify(newRefreshRecord),
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: this.toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      },
    };
  }

  async logout(refreshTokenString?: string): Promise<void> {
    if (!refreshTokenString) return;
    const tokenId = JwtService.extractTokenId(refreshTokenString);
    if (tokenId) {
      await this.storage.del(`refresh_token:${tokenId}`);
    }
  }

  /**
   * Seed default demo user if not existing
   */
  async seedDefaultUsers(): Promise<void> {
    const demoEmail = process.env.DEMO_USER_EMAIL || 'lukas@burian.cz';
    const existing = await this.findUserByEmail(demoEmail);

    if (!existing) {
      const demoPassword = process.env.DEMO_USER_PASSWORD || 'portfolio2026';
      console.log(`[AuthService] Seeding default demo user: ${demoEmail}`);
      await this.register({
        email: demoEmail,
        password: demoPassword,
        name: 'Lukáš Burian',
        role: 'admin',
        profileId: 'profile_lukas_default',
      });
    }
  }
}
