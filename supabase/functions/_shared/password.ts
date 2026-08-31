// Shared password hashing helpers for SIGAP Edge Functions.
// Pure Deno Web Crypto (PBKDF2-SHA256), no external dependencies.

const TEXT_ENCODER = new TextEncoder();
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/**
 * Base64url encode without padding.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Base64url decode without padding.
 */
function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return new Uint8Array(bin.split("").map((c) => c.charCodeAt(0)));
}

function parseStoredHash(stored: string):
  | { iterations: number; salt: Uint8Array; hash: Uint8Array }
  | null {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return null;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return null;
  try {
    const salt = base64UrlDecode(parts[2]);
    const hash = base64UrlDecode(parts[3]);
    return { iterations, salt, hash };
  } catch {
    return null;
  }
}

async function deriveHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Hash password dengan PBKDF2-SHA256. Format: pbkdf2_sha256$<iter>$<salt_b64url>$<hash_b64url>
 * Pepper ditambahkan ke password sebelum hashing supaya hash saja tidak cukup
 * untuk brute-force offline tanpa juga memiliki pepper.
 */
export async function hashPassword(
  password: string,
  pepper: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveHash(password + pepper, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(
    hash,
  )}`;
}

/**
 * Verifikasi timing-safe password terhadap stored hash.
 */
export async function verifyPassword(
  password: string,
  stored: string,
  pepper: string,
): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const expected = await deriveHash(password + pepper, parsed.salt, parsed.iterations);
  if (expected.length !== parsed.hash.length) return false;
  let equal = 0;
  for (let i = 0; i < expected.length; i++) {
    equal |= expected[i] ^ parsed.hash[i];
  }
  return equal === 0;
}
