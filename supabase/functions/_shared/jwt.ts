const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ISSUER = "sigap";
const AUDIENCE = "sigap";

const TEXT_ENCODER = new TextEncoder();

export interface ProfileClaims {
  role: string;
  dinas_id?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
}

export interface AccessTokenPayload extends ProfileClaims {
  sub: string;
  jti: string;
  role: "authenticated";
  app_role: string;
  type: "access";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
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
  const raw = Deno.env.get("SUPABASE_JWT_SECRET") ||
    Deno.env.get("SIGAP_JWT_SECRET") ||
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
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp && exp < now) throw new Error("Token expired");

  return payload;
}

export async function createAccessToken(
  userId: string,
  profile: ProfileClaims,
): Promise<string> {
  return await signJwt(
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      jti: crypto.randomUUID(),
      role: "authenticated",
      app_role: profile.role,
      dinas_id: profile.dinas_id ?? null,
      kelurahan: profile.kelurahan ?? null,
      kecamatan: profile.kecamatan ?? null,
      type: "access",
      iss: ISSUER,
      aud: AUDIENCE,
      iat: getNumericDate(0),
      exp: getNumericDate(ACCESS_TOKEN_TTL_SECONDS),
    },
    await importSecret(),
  );
}

export async function createRefreshToken(userId: string): Promise<string> {
  return await signJwt(
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      jti: crypto.randomUUID(),
      type: "refresh",
      iss: ISSUER,
      aud: AUDIENCE,
      iat: getNumericDate(0),
      exp: getNumericDate(REFRESH_TOKEN_TTL_SECONDS),
    },
    await importSecret(),
  );
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

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  const payload = await verifyJwt(token, await importSecret());
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return payload as unknown as RefreshTokenPayload;
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
