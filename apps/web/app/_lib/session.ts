// Tooling petugas (staff) berbasis web — token disimpan di localStorage,
// bukan SecureStore seperti mobile, karena ini bukan data warga dan hanya
// dipakai di perangkat kantor untuk mengelola periode voting dan tinjauan
// aspirasi. Menyalin pola refresh token dari apps/native/app/_components/session.ts.
import { decodeJwtPayload } from './jwtDecode';

const ACCESS_TOKEN_KEY = 'sigap_staff_access_token';
const REFRESH_TOKEN_KEY = 'sigap_staff_refresh_token';
const ACCESS_TOKEN_EXP_KEY = 'sigap_staff_access_token_exp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExp: number;
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(ACCESS_TOKEN_EXP_KEY, String(tokens.accessTokenExp));
}

export function loadTokens(): StoredTokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expStr = localStorage.getItem(ACCESS_TOKEN_EXP_KEY);
  if (!accessToken || !refreshToken || !expStr) return null;
  const accessTokenExp = Number(expStr);
  if (Number.isNaN(accessTokenExp)) return null;
  return { accessToken, refreshToken, accessTokenExp };
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_EXP_KEY);
}

export function getTokenExpiry(token: string): number {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ?? 0;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExp: number;
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.accessToken || !data.refreshToken) {
      return null;
    }
    const tokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExp: getTokenExpiry(data.accessToken),
    };
    saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

/** getAccessToken dipanggil setiap kali supabase-js perlu token, menyegarkan
 * token yang hampir kedaluwarsa sebelum mengembalikannya — sama seperti pola
 * mobile di apps/native/app/_components/session.ts. */
export async function getAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokens.accessTokenExp - now < 300) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed) return refreshed.accessToken;
    clearTokens();
    return null;
  }
  return tokens.accessToken;
}
