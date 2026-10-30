import { JwtAccessPayload } from './types';
import { JwtService } from './jwtService';

export class AuthMiddleware {
  static parseCookies(cookieHeader?: string | null): Record<string, string> {
    if (!cookieHeader) return {};
    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(';');

    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx > -1) {
        const key = pair.substring(0, idx).trim();
        const val = pair.substring(idx + 1).trim();
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
    return cookies;
  }

  static extractAccessToken(req: Request): string | null {
    // 1. Authorization header: Bearer <token>
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // 2. Cookie: access_token=<token>
    const cookies = this.parseCookies(req.headers.get('Cookie'));
    if (cookies.access_token) {
      return cookies.access_token;
    }

    return null;
  }

  static extractRefreshToken(req: Request, body?: any): string | null {
    // 1. JSON payload body
    if (body && typeof body.refreshToken === 'string') {
      return body.refreshToken;
    }

    // 2. Cookie: refresh_token=<token>
    const cookies = this.parseCookies(req.headers.get('Cookie'));
    if (cookies.refresh_token) {
      return cookies.refresh_token;
    }

    return null;
  }

  static async authenticate(req: Request): Promise<JwtAccessPayload | null> {
    const token = this.extractAccessToken(req);
    if (!token) return null;
    return await JwtService.verifyAccessToken(token);
  }

  static createCookieHeaders(tokens?: { accessToken?: string; refreshToken?: string; clear?: boolean }): string[] {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite = 'SameSite=Lax';
    const secure = isProd ? '; Secure' : '';
    const headers: string[] = [];

    if (tokens?.clear) {
      headers.push(`access_token=; Path=/; HttpOnly; ${sameSite}; Max-Age=0${secure}`);
      headers.push(`refresh_token=; Path=/; HttpOnly; ${sameSite}; Max-Age=0${secure}`);
      return headers;
    }

    if (tokens?.accessToken) {
      headers.push(`access_token=${tokens.accessToken}; Path=/; HttpOnly; ${sameSite}; Max-Age=900${secure}`);
    }

    if (tokens?.refreshToken) {
      const sevenDays = 7 * 24 * 60 * 60;
      headers.push(`refresh_token=${tokens.refreshToken}; Path=/; HttpOnly; ${sameSite}; Max-Age=${sevenDays}${secure}`);
    }

    return headers;
  }
}
