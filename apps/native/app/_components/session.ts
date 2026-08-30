import { decodeJwtPayload } from './jwtDecode';
import { baseUrl } from './api';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
} from './SecureStore';

const REFRESH_TOKEN_KEY = 'sigap_refresh_token';

let memoryAccessToken: string | null = null;
let memoryAccessTokenExp = 0;
let onAccessTokenChange: ((token: string) => void) | null = null;

export function setAccessTokenChangeHandler(
  handler: ((token: string) => void) | null,
): void {
  onAccessTokenChange = handler;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExp: number;
}

export async function loadRefreshToken(): Promise<string | null> {
  return getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearRefreshToken(): Promise<void> {
  await deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function setAccessToken(accessToken: string): void {
  memoryAccessToken = accessToken;
  memoryAccessTokenExp = getTokenExpiry(accessToken);
  onAccessTokenChange?.(accessToken);
}

export function clearAccessToken(): void {
  memoryAccessToken = null;
  memoryAccessTokenExp = 0;
}

export async function getAccessToken(): Promise<string | null> {
  const token = memoryAccessToken;
  if (token) {
    const now = Math.floor(Date.now() / 1000);
    if (memoryAccessTokenExp - now >= 300) {
      return token;
    }
  }

  // Token tidak ada atau hampir kedaluwarsa: coba segarkan dari SecureStore.
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) {
    clearAccessToken();
    return null;
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (refreshed) {
    return refreshed.accessToken;
  }

  // Pemanggil paralel lain mungkin sudah berhasil menyegarkan sementara
  // kita menunggu; periksa memori sekali lagi sebelum menyerah.
  const latest = memoryAccessToken;
  if (latest) {
    const now = Math.floor(Date.now() / 1000);
    if (memoryAccessTokenExp - now >= 300) {
      return latest;
    }
  }

  await clearTokens();
  return null;
}

export async function clearTokens(): Promise<void> {
  clearAccessToken();
  await clearRefreshToken();
}

/**
 * Satu permintaan refresh yang sedang berjalan, dibagi ke semua pemanggil.
 *
 * `auth-refresh` MEROTASI refresh token: token lama langsung di-`revoke`
 * begitu yang baru diterbitkan. `getAccessToken` dipanggil supabase-js pada
 * SETIAP permintaan, jadi satu layar yang memuat beberapa query sekaligus
 * akan mengirim refresh token lama yang sama beberapa kali — hanya yang
 * pertama berhasil, sisanya balik `session_expired`, memanggil
 * `clearTokens()`, dan warga terlempar keluar tanpa sebab yang jelas.
 */
let inFlightRefresh: Promise<RefreshResult | null> | null = null;

export function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefreshAccessToken(refreshToken).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function doRefreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult | null> {
  try {
    const response = await fetch(`${baseUrl}/functions/v1/auth-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    if (!data.ok || !data.accessToken || !data.refreshToken) {
      return null;
    }
    const accessTokenExp = getTokenExpiry(data.accessToken);
    setAccessToken(data.accessToken);
    await saveRefreshToken(data.refreshToken);
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, accessTokenExp };
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string): number {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ?? 0;
}
