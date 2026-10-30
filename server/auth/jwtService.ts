import { SignJWT, jwtVerify } from 'jose';
import { JwtAccessPayload, RefreshTokenRecord, User } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-tracker-jwt-secret-key-dev-and-prod-2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class JwtService {
  /**
   * Generates a signed short-lived JWT Access Token (15m)
   */
  static async generateAccessToken(user: User): Promise<string> {
    return await new SignJWT({
      email: user.email,
      name: user.name,
      role: user.role,
      profileId: user.profileId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_EXPIRY_SECONDS}s`)
      .sign(secretKey);
  }

  /**
   * Verifies and decodes a JWT Access Token
   */
  static async verifyAccessToken(token: string): Promise<JwtAccessPayload | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      if (!payload.sub || typeof payload.sub !== 'string') return null;

      return {
        sub: payload.sub,
        email: String(payload.email || ''),
        name: String(payload.name || ''),
        role: (payload.role as any) || 'user',
        profileId: String(payload.profileId || ''),
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Creates a random cryptographically secure Refresh Token and its persistence record
   */
  static generateRefreshTokenRecord(
    userId: string,
    userAgent?: string,
    ip?: string,
    existingFamilyId?: string
  ): { token: string; record: RefreshTokenRecord } {
    const tokenId = crypto.randomUUID();
    const tokenSecret = crypto.randomUUID().replace(/-/g, '');
    const token = `rt_${tokenId}_${tokenSecret}`;
    const now = Date.now();

    const record: RefreshTokenRecord = {
      tokenId,
      userId,
      familyId: existingFamilyId || crypto.randomUUID(),
      expiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
      createdAt: now,
      userAgent,
      ip,
      isRevoked: false,
    };

    return { token, record };
  }

  /**
   * Extracts tokenId from a refresh token string
   */
  static extractTokenId(refreshTokenString: string): string | null {
    if (!refreshTokenString.startsWith('rt_')) return null;
    const parts = refreshTokenString.split('_');
    if (parts.length < 3) return null;
    return parts[1]; // tokenId UUID
  }
}
