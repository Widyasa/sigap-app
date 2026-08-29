// Shared OTP helpers for SIGAP Edge Functions.
// Pure Deno, no external dependencies.

const TEXT_ENCODER = new TextEncoder();

/** Generate a zero-padded six-digit OTP code using CSPRNG. */
export function generateCode(): string {
  // Rejection sampling. `buf[0] % 1_000_000` menghasilkan bias modulo: 2^32
  // bukan kelipatan 1.000.000, sehingga kode di bawah 967.296 sedikit lebih
  // sering muncul. Tidak ada serangan praktis dari selisih ~0,02%, tapi
  // pembangkit kode masuk tidak seharusnya punya distribusi miring sama
  // sekali. Batas di bawah adalah kelipatan 1.000.000 terbesar yang muat.
  const LIMIT = 4_294_000_000;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0]! >= LIMIT);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

/** SHA-256 hex digest of (code + pepper). */
export async function hashCode(code: string, pepper: string): Promise<string> {
  const data = TEXT_ENCODER.encode(code + pepper);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Timing-safe verification of a candidate OTP against a stored hash. */
export async function verifyCode(
  candidate: string,
  hash: string,
  pepper: string,
): Promise<boolean> {
  if (!candidate || !hash || !pepper) return false;
  const expected = await hashCode(candidate, pepper);
  if (expected.length !== hash.length) return false;
  let equal = 0;
  for (let i = 0; i < expected.length; i++) {
    equal |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return equal === 0;
}
