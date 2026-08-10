// Shared OTP helpers for SIGAP Edge Functions.
// Pure Deno, no external dependencies.

const TEXT_ENCODER = new TextEncoder();

/** Generate a zero-padded six-digit OTP code using CSPRNG. */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const num = buf[0] % 1_000_000;
  return String(num).padStart(6, "0");
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
