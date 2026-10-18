/**
 * authHelper.ts — Cryptographic password hashing, token generation, and verification
 * Uses native Node.js crypto (PBKDF2 + HMAC-SHA256) for secure, zero-dependency authentication.
 */
import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'lyka_realty_jwt_secret_key_production_grade_2026';

export interface AuthTokenPayload {
  id: string;
  loginId: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  exp: number;
}

/**
 * Hash a password using PBKDF2 with SHA-512 and random salt
 */
export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return `${actualSalt}:${derivedKey}`;
}

/**
 * Verify a plain text password against a stored <salt>:<hash> string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  try {
    const [salt, originalHash] = storedHash.split(':');
    const calculatedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const bufA = Buffer.from(calculatedHash, 'hex');
    const bufB = Buffer.from(originalHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    return false;
  }
}

/**
 * Sign an auth token (HMAC-SHA256 URL-safe token)
 */
export function generateToken(payload: Omit<AuthTokenPayload, 'exp'>, expiresInHours: number = 72): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const fullPayload: AuthTokenPayload = { ...payload, exp };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an auth token
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  try {
    const [encodedPayload, signature] = token.split('.');
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    const bufExpected = Buffer.from(expectedSig);
    const bufActual = Buffer.from(signature);
    if (bufExpected.length !== bufActual.length) return null;
    if (!crypto.timingSafeEqual(bufExpected, bufActual)) return null;

    const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as AuthTokenPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decoded;
  } catch (err) {
    return null;
  }
}
