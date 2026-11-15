import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

function key() {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('SESSION_SECRET must be set (16+ characters) in production');
  }
  return 'dev-only-secret-do-not-use-in-production';
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
export const randomCircleCode = () =>
  Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
export const randomDigits = (n = 6) => String(crypto.randomInt(0, 10 ** n)).padStart(n, '0');

export const hashSecret = (s: string) => bcrypt.hash(s, 10);
export const checkSecret = (s: string, hash: string) => bcrypt.compare(s, hash);

function sign(body: string) {
  return crypto.createHmac('sha256', key()).update(body).digest('base64url');
}
/** Signed, expiring token: base64url(json).signature */
export function seal(payload: object, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${body}.${sign(body)}`;
}
export function unseal<T>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const WEAK = new Set(['000000', '111111', '123456', '654321', '121212', '123123', '112233', '999999', '888888', '777777', '666666', '555555', '444444', '333333', '222222']);
export const isWeakPasscode = (p: string) => WEAK.has(p);
