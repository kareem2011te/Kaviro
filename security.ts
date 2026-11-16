import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { SafeUser, User, UserRole } from './types.ts';

const TOKEN_SECRET =
  process.env.KAVIRO_SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + ':kaviro-platform-secret-v1').digest('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(token).digest('hex');
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken) };
}

export function generateNumericCode(digits = 6): string {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function sanitizeUser(user: User): SafeUser {
  const {
    passwordHash: _p,
    emailVerificationCode: _e,
    resetPasswordCode: _r,
    twoFactorSecret: _t,
    ...safe
  } = user;
  return safe;
}

export function parseUserAgent(ua = ''): {
  deviceType: 'Desktop' | 'Tablet' | 'Mobile';
  browser: string;
  os: string;
} {
  const lower = ua.toLowerCase();
  let deviceType: 'Desktop' | 'Tablet' | 'Mobile' = 'Desktop';
  if (/ipad|tablet|playbook|silk/.test(lower)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(lower)) {
    deviceType = 'Mobile';
  }

  let browser = 'Unknown Browser';
  if (lower.includes('edg/')) browser = 'Microsoft Edge';
  else if (lower.includes('chrome/') && !lower.includes('chromium')) browser = 'Google Chrome';
  else if (lower.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Apple Safari';
  else if (lower.includes('curl')) browser = 'cURL Client';

  let os = 'Unknown OS';
  if (lower.includes('windows nt')) os = 'Windows';
  else if (lower.includes('mac os x')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  return { deviceType, browser, os };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Server-side CAPTCHA challenge store (HMAC signed + short TTL)
interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}
const captchaStore = new Map<string, CaptchaEntry>();

export function createCaptchaChallenge(): {
  challengeId: string;
  svgDataUri: string;
  promptHint: string;
} {
  const now = Date.now();
  for (const [key, val] of captchaStore.entries()) {
    if (val.expiresAt < now) captchaStore.delete(key);
  }

  const a = crypto.randomInt(10, 40);
  const b = crypto.randomInt(2, 19);
  const op = crypto.randomInt(0, 2) === 0 ? '+' : '-';
  const answer = op === '+' ? String(a + b) : String(a - b);
  const expression = `${a} ${op} ${b} = ?`;
  const challengeId = crypto.randomUUID();
  captchaStore.set(challengeId, { answer, expiresAt: now + 5 * 60 * 1000 });

  const noiseLines = Array.from({ length: 5 }, (_, i) => {
    const x1 = crypto.randomInt(0, 60);
    const y1 = crypto.randomInt(5, 55);
    const x2 = crypto.randomInt(150, 220);
    const y2 = crypto.randomInt(5, 55);
    const color = i % 2 === 0 ? '#1D7AFC' : '#00D4FF';
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-opacity="0.35" stroke-width="1.5"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60">
    <rect width="220" height="60" rx="10" fill="#071022"/>
    <rect x="1" y="1" width="218" height="58" rx="9" fill="none" stroke="#1D7AFC" stroke-opacity="0.4"/>
    ${noiseLines}
    <text x="110" y="38" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="#E2F1FF" letter-spacing="3" transform="rotate(${crypto.randomInt(-3, 4)} 110 30)">${expression}</text>
  </svg>`;

  return {
    challengeId,
    svgDataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    promptHint: 'Solve the security verification math expression',
  };
}

export function verifyCaptchaChallenge(challengeId: string, userAnswer: string): boolean {
  const entry = captchaStore.get(challengeId);
  if (!entry) return false;
  captchaStore.delete(challengeId);
  if (Date.now() > entry.expiresAt) return false;
  return entry.answer.trim() === userAnswer.trim();
}

// Sliding window rate limiter
const rateBuckets = new Map<string, number[]>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${getClientIp(req)}:${req.path}`;
    const now = Date.now();
    const history = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (history.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    history.push(now);
    rateBuckets.set(key, history);
    next();
  };
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

export function hasRole(user: SafeUser, allowed: UserRole[]): boolean {
  return allowed.includes(user.role);
}
