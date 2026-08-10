import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

export async function createAccessToken(
  userId: string,
  profile: ProfileClaims,
): Promise<string> {
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      jti: crypto.randomUUID(),
      role: profile.role,
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
  return await create(
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
  const payload = await verify(token, await importSecret());
  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  const payload = await verify(token, await importSecret());
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return payload as unknown as RefreshTokenPayload;
}

export function getTokenExpirySeconds(token: string): number {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return 0;
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    );
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}
