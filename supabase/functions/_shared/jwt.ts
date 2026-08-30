const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours (buffer for edge-function clock skew)
const ISSUER = "sigap";
const AUDIENCE = "authenticated";

const TEXT_ENCODER = new TextEncoder();

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  role: "authenticated";
  type: "access";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return new Uint8Array(bin.split("").map((c) => c.charCodeAt(0)));
}

function getNumericDate(offsetSeconds: number): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

async function importSecret(): Promise<CryptoKey> {
  const raw = Deno.env.get("SIGAP_JWT_SECRET") ||
    Deno.env.get("SUPABASE_JWT_SECRET") ||
    Deno.env.get("SUPABASE_INTERNAL_JWT_SECRET");
  if (!raw) throw new Error("JWT secret is not set (SUPABASE_JWT_SECRET or SIGAP_JWT_SECRET)");
  return await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
): Promise<string> {
  const encodedHeader = base64UrlEncode(TEXT_ENCODER.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(TEXT_ENCODER.encode(JSON.stringify(payload)));
  const data = TEXT_ENCODER.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

async function verifyJwt(
  token: string,
  key: CryptoKey,
): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  // Algoritma di header WAJIB diperiksa. Verifikasi selalu memakai kunci
  // HMAC yang diimpor, jadi `alg: none` dan kebingungan asimetris sudah
  // gagal di pemeriksaan tanda tangan hari ini — tetapi menegaskannya di
  // sini mencegah perubahan pemilihan kunci di masa depan membuka celah itu.
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as {
    alg?: unknown;
  };
  if (header.alg !== "HS256") throw new Error("Unsupported token algorithm");

  const data = TEXT_ENCODER.encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature as unknown as ArrayBuffer,
    data,
  );
  if (!valid) throw new Error("Invalid token signature");

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(parts[1])),
  ) as Record<string, unknown>;

  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) {
    throw new Error("Invalid token issuer or audience");
  }

  const now = getNumericDate(0);
  // `if (exp && exp < now)` DULU meloloskan token yang sama sekali TIDAK
  // punya `exp` — yaitu token tanpa masa berlaku. Tidak terjangkau lewat
  // `createAccessToken`, tapi penjagaan yang bergantung pada bentuk data
  // yang kebetulan benar bukan penjagaan.
  const exp = payload.exp;
  if (typeof exp !== "number" || exp < now) throw new Error("Token expired");

  return payload;
}

export async function createAccessToken(userId: string): Promise<string> {
  return await signJwt(
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      jti: crypto.randomUUID(),
      role: "authenticated",
      type: "access",
      iss: ISSUER,
      aud: AUDIENCE,
      iat: getNumericDate(0),
      exp: getNumericDate(ACCESS_TOKEN_TTL_SECONDS),
    },
    await importSecret(),
  );
}

/**
 * Membuat refresh token opak: 32 byte acak, dikodekan sebagai hex.
 * Token ini bukan JWT dan disimpan di SecureStore tanpa modifikasi.
 */
export function createRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const payload = await verifyJwt(token, await importSecret());
  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload as unknown as AccessTokenPayload;
}

export function getTokenExpirySeconds(token: string): number {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return 0;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(base64)),
    ) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}
