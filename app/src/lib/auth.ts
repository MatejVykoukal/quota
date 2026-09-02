import {
  createHash,
  randomBytes,
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/* ---------------- API keys ---------------- */

const KEY_PREFIX = "qk_live_";

/** Generate a new API key. Returns plaintext once — store only the hash. */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  return { key, keyHash: hashApiKey(key), keyPrefix: key.slice(0, 12) + "…" };
}

/**
 * Hash an API key for storage/lookup. Lookup goes through a DB index on the
 * hash — the plaintext secret is never compared in application memory, so a
 * constant-time comparison is not required here.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/* ---------------- Sessions ---------------- */

const SESSION_COOKIE = "quota_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Demo credentials — single-user MVP. The password exists only as a source
 * for the startup hash; verification always goes through the same hashed
 * comparison path as production would.
 */
export const DEMO_EMAIL = "demo@quota.dev";
const DEMO_PASSWORD = "demo1234";

/**
 * Hash a password with scrypt (random salt). Format: salt:hash.
 * The plaintext password never leaves the caller and is never stored.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/**
 * Verify a password against a scrypt hash in constant time.
 * Use instead of raw string comparison — see timing attacks.
 */
export function verifyPassword(
  password: string,
  stored: string,
): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const DEMO_PASSWORD_HASH = hashPassword(DEMO_PASSWORD);

export function verifyDemoPassword(password: string): boolean {
  return verifyPassword(password, DEMO_PASSWORD_HASH);
}

function sign(value: string): string {
  return createHmac("sha256", env.authSecret)
    .update(value)
    .digest("base64url");
}

export function createSessionToken(): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const payload = `demo.${expiresAt.getTime()}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (sign(payload) !== parts[2]) return false;
  return parseInt(parts[1]) > Date.now();
}

export async function setSessionCookie() {
  const { token, expiresAt } = createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
