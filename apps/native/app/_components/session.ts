import { decodeJwtPayload } from './jwtDecode';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
} from './SecureStore';

const ACCESS_TOKEN_KEY = 'sigap_access_token';
const REFRESH_TOKEN_KEY = 'sigap_refresh_token';
const ACCESS_TOKEN_EXP_KEY = 'sigap_access_token_exp';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExp: number;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    setItemAsync(ACCESS_TOKEN_EXP_KEY, String(tokens.accessTokenExp)),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, expStr] = await Promise.all([
    getItemAsync(ACCESS_TOKEN_KEY),
    getItemAsync(REFRESH_TOKEN_KEY),
    getItemAsync(ACCESS_TOKEN_EXP_KEY),
  ]);
  if (!accessToken || !refreshToken || !expStr) return null;
  const accessTokenExp = Number(expStr);
  if (Number.isNaN(accessTokenExp)) return null;
  return { accessToken, refreshToken, accessTokenExp };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteItemAsync(ACCESS_TOKEN_KEY),
    deleteItemAsync(REFRESH_TOKEN_KEY),
    deleteItemAsync(ACCESS_TOKEN_EXP_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);
  // Refresh if token expires within the next 5 minutes.
  if (tokens.accessTokenExp - now < 300) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed) return refreshed.accessToken;
    await clearTokens();
    return null;
  }
  return tokens.accessToken;
}

export async function getRefreshToken(): Promise<string | null> {
  return getItemAsync(REFRESH_TOKEN_KEY);
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExp: number;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult | null> {
  try {
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const response = await fetch(`${baseUrl}/functions/v1/auth-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.accessToken || !data.refreshToken) {
      return null;
    }
    const accessTokenExp = getTokenExpiry(data.accessToken);
    const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken, accessTokenExp };
    await saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string): number {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ?? 0;
}
