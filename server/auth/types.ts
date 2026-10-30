export type UserRole = 'admin' | 'user' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  profileId: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profileId: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // in seconds (e.g. 900 for 15m)
}

export interface RefreshTokenRecord {
  tokenId: string; // unique random id / jti
  userId: string;
  familyId: string; // for token rotation reuse detection
  expiresAt: number; // epoch ms
  createdAt: number;
  userAgent?: string;
  ip?: string;
  isRevoked?: boolean;
}

export interface JwtAccessPayload {
  sub: string; // userId
  email: string;
  name: string;
  role: UserRole;
  profileId: string;
  iat?: number;
  exp?: number;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  profileId?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshDto {
  refreshToken: string;
}
