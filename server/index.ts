import { serve } from 'bun';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { initStorage, getStorage } from './storage';
import { AuthService } from './auth/authService';
import { AuthMiddleware } from './auth/authMiddleware';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const VITE_DEV_SERVER = 'http://localhost:5173';

// Initialize Storage (Redis in production if configured, else In-Memory)
const storage = await initStorage();
const authService = new AuthService(storage);
await authService.seedDefaultUsers();

const quoteCache = new Map<string, { data: any; expiresAt: number }>();
let fxCache: { rates: Record<string, number>; expiresAt: number } | null = null;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchYahooQuote(symbol: string): Promise<any | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) {
      return null;
    }

    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol,
      price,
      currency: meta.currency?.toUpperCase() ?? 'USD',
      previousClose,
      change,
      changePercent,
      marketState: meta.tradingPeriods?.post ? 'CLOSED' : 'REGULAR',
      timestamp: Date.now(),
    };
  } catch (err) {
    return null;
  }
}

async function fetchFrankfurterRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (fxCache && fxCache.expiresAt > now) {
    return fxCache.rates;
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rates = { ...data.rates, EUR: 1.0 };
      fxCache = { rates, expiresAt: now + 60 * 60 * 1000 };
      return rates;
    }
  } catch (e) {
    console.warn('Frankfurter API fetch failed, using fallback rates', e);
  }

  return fxCache?.rates || { EUR: 1.0, CZK: 25.25, USD: 1.085, GBP: 0.855 };
}

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '*';

    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        },
      });
    }

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    };

    const jsonResponse = (data: any, status = 200, cookieHeaders: string[] = []) => {
      const h = new Headers(baseHeaders);
      for (const c of cookieHeaders) {
        h.append('Set-Cookie', c);
      }
      return new Response(JSON.stringify(data), { status, headers: h });
    };

    // 2. Health check (includes storage status)
    if (url.pathname === '/api/health') {
      const storageStatus = await storage.getStatus();
      return jsonResponse({
        status: 'healthy',
        bunVersion: Bun.version,
        uptimeSeconds: Math.floor(process.uptime()),
        cachedQuotesCount: quoteCache.size,
        storage: storageStatus,
      });
    }

    // 3. Auth Endpoints
    // 3a. POST /api/auth/register
    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { user, tokens } = await authService.register(body);
        const cookieHeaders = AuthMiddleware.createCookieHeaders(tokens);
        return jsonResponse({ user, tokens }, 201, cookieHeaders);
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Registrace selhala' }, 400);
      }
    }

    // 3b. POST /api/auth/login
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await req.json();
        const userAgent = req.headers.get('user-agent') || undefined;
        const ip = req.headers.get('x-forwarded-for') || undefined;

        const { user, tokens } = await authService.login(body, { userAgent, ip });
        const cookieHeaders = AuthMiddleware.createCookieHeaders(tokens);
        return jsonResponse({ user, tokens }, 200, cookieHeaders);
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Přihlášení selhalo' }, 401);
      }
    }

    // 3c. POST /api/auth/refresh (Token Rotation)
    if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
      try {
        let body: any = {};
        try {
          body = await req.json();
        } catch {
          // body can be empty if token is in cookie
        }

        const refreshToken = AuthMiddleware.extractRefreshToken(req, body);
        if (!refreshToken) {
          return jsonResponse({ error: 'Chybí refresh token' }, 401);
        }

        const userAgent = req.headers.get('user-agent') || undefined;
        const ip = req.headers.get('x-forwarded-for') || undefined;

        const { user, tokens } = await authService.rotateRefreshToken(refreshToken, { userAgent, ip });
        const cookieHeaders = AuthMiddleware.createCookieHeaders(tokens);
        return jsonResponse({ user, tokens }, 200, cookieHeaders);
      } catch (err: any) {
        const clearHeaders = AuthMiddleware.createCookieHeaders({ clear: true });
        return jsonResponse({ error: err.message || 'Obnovení tokenu selhalo' }, 401, clearHeaders);
      }
    }

    // 3d. POST /api/auth/logout
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      try {
        let body: any = {};
        try {
          body = await req.json();
        } catch {
          // ignore
        }
        const refreshToken = AuthMiddleware.extractRefreshToken(req, body);
        if (refreshToken) {
          await authService.logout(refreshToken);
        }
        const clearHeaders = AuthMiddleware.createCookieHeaders({ clear: true });
        return jsonResponse({ success: true, message: 'Byli jste úspěšně odhlášeni' }, 200, clearHeaders);
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Chyba při odhlášení' }, 500);
      }
    }

    // 3e. GET /api/auth/me (Current Authenticated User)
    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      const payload = await AuthMiddleware.authenticate(req);
      if (!payload) {
        return jsonResponse({ error: 'Neautorizováno. Přihlaste se prosím.' }, 401);
      }

      const user = await authService.getUserById(payload.sub);
      if (!user) {
        return jsonResponse({ error: 'Uživatel nenalezen' }, 404);
      }

      return jsonResponse({ user: authService.toPublicUser(user) });
    }

    // 3f. GET /api/auth/status (Storage and Auth Diagnostics)
    if (url.pathname === '/api/auth/status' && req.method === 'GET') {
      const storageStatus = await storage.getStatus();
      return jsonResponse({
        storage: storageStatus,
        auth: {
          accessTokenExpirySeconds: 900, // 15m
          refreshTokenExpirySeconds: 7 * 24 * 60 * 60, // 7 days
          algorithm: 'HS256',
        },
      });
    }

    // 4. Batch Quotes: GET /api/quotes?symbols=SXR8.DE,VUAA.L,AAPL
    if (url.pathname === '/api/quotes' && req.method === 'GET') {
      const symbolsParam = url.searchParams.get('symbols') || '';
      const symbols = symbolsParam
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (symbols.length === 0) {
        return jsonResponse({ error: 'Missing symbols parameter' }, 400);
      }

      const now = Date.now();
      const results: Record<string, any> = {};
      const missingSymbols: string[] = [];

      for (const sym of symbols) {
        const cached = quoteCache.get(sym);
        if (cached && cached.expiresAt > now) {
          results[sym] = cached.data;
        } else {
          missingSymbols.push(sym);
        }
      }

      if (missingSymbols.length > 0) {
        const CHUNK_SIZE = 5;
        for (let i = 0; i < missingSymbols.length; i += CHUNK_SIZE) {
          const chunk = missingSymbols.slice(i, i + CHUNK_SIZE);
          await Promise.allSettled(chunk.map(async sym => {
            const quote = await fetchYahooQuote(sym);
            if (quote) {
              quoteCache.set(sym, { data: quote, expiresAt: now + 15 * 60 * 1000 });
              results[sym] = quote;
            } else {
              results[sym] = quoteCache.get(sym)?.data || null;
            }
          }));
        }
      }

      return jsonResponse({ quotes: results, timestamp: now });
    }

    // 5. FX Endpoint: GET /api/fx
    if (url.pathname === '/api/fx' && req.method === 'GET') {
      const rates = await fetchFrankfurterRates();
      return jsonResponse({ base: 'EUR', rates, timestamp: Date.now() });
    }

    // 5b. Benchmark Performance Endpoint: GET /api/benchmarks
    if (url.pathname === '/api/benchmarks' && req.method === 'GET') {
      return jsonResponse({
        timestamp: Date.now(),
        SP500: { YTD: 18.4, '1Y': 17.4, '3Y': 69.7, '5Y': 78.6, ALL: 95.0 },
        ALL_WORLD: { YTD: 16.1, '1Y': 15.2, '3Y': 48.3, '5Y': 62.5, ALL: 75.0 },
        GOLD: { YTD: 29.8, '1Y': 38.4, '3Y': 54.6, '5Y': 64.2, ALL: 72.0 },
      });
    }

    // 6. Sample Statements Endpoint: GET /api/sample-files
    if (url.pathname === '/api/sample-files' && req.method === 'GET') {
      const sampleDir = join(import.meta.dir, '../sample_data');
      const files: Array<{ name: string; base64: string; size: number }> = [];

      if (existsSync(sampleDir)) {
        const list = readdirSync(sampleDir);
        for (const f of list) {
          if (f.endsWith('.xlsx') || f.endsWith('.csv')) {
            const fullPath = join(sampleDir, f);
            const buf = readFileSync(fullPath);
            files.push({
              name: f,
              base64: buf.toString('base64'),
              size: buf.length,
            });
          }
        }
      }

      return jsonResponse({ files });
    }

    // 6b. PDF Parse Endpoint: POST /api/parse-pdf
    if (url.pathname === '/api/parse-pdf' && req.method === 'POST') {
      try {
        const body = await req.json();
        const base64 = body.base64;
        if (!base64) {
          return jsonResponse({ error: 'Missing base64 data' }, 400);
        }
        const { PDFParse } = await import('pdf-parse');
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const parser = new PDFParse({ data: bytes });
        const textResult = await parser.getText();
        return jsonResponse({ text: textResult.text, pages: textResult.total });
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'PDF parse error' }, 500);
      }
    }

    // 7. Static Assets or Vite Dev Proxy
    const distPath = join(import.meta.dir, '../dist');
    const indexPath = join(distPath, 'index.html');

    // In dev mode, if Vite dev server is running on 5173, proxy to it for HMR
    if (!IS_PROD) {
      try {
        const targetUrl = new URL(url.pathname + url.search, VITE_DEV_SERVER);
        const reqHeaders = new Headers(req.headers);
        reqHeaders.set('host', targetUrl.host);

        const viteRes = await fetch(targetUrl.toString(), {
          method: req.method,
          headers: reqHeaders,
          body: req.body,
          signal: AbortSignal.timeout(600),
        });
        return viteRes;
      } catch {
        // Vite is not running on 5173: fall back to serving dist/ seamlessly!
      }
    }

    // Serve static files from dist/
    let filePath = join(distPath, url.pathname);
    if (existsSync(filePath) && !(await Bun.file(filePath).stat())?.isDirectory()) {
      const file = Bun.file(filePath);
      const res = new Response(file);
      if (url.pathname.startsWith('/assets/')) {
        res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
      return res;
    }

    if (existsSync(indexPath)) {
      return new Response(Bun.file(indexPath), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found. Please run `bun run build`.', { status: 404 });
  },
});

console.log(`⚡ Bun Portfolio Server running at http://localhost:${server.port} [${process.env.NODE_ENV || 'development'}]`);
