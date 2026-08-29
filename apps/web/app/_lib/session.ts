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
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(ACCESS_TOKEN_EXP_KEY, String(tokens.accessTokenExp));
}

export function loadTokens(): StoredTokens | null {
  // Dipanggil dari modul yang juga diimpor saat prerender Next.js, di mana
  // `localStorage` tidak ada.
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expStr = localStorage.getItem(ACCESS_TOKEN_EXP_KEY);
  if (!accessToken || !refreshToken || !expStr) return null;
  const accessTokenExp = Number(expStr);
  if (Number.isNaN(accessTokenExp)) return null;
  return { accessToken, refreshToken, accessTokenExp };
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
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

/**
 * Satu permintaan refresh yang sedang berjalan, dibagi ke semua pemanggil.
 *
 * `auth-refresh` MEROTASI refresh token: token lama langsung di-`revoke`
 * begitu yang baru diterbitkan. Tanpa penguncian ini, satu halaman dashboard
 * yang menembak beberapa query paralel akan memanggil `getAccessToken()`
 * beberapa kali sekaligus, semuanya membawa refresh token lama yang sama —
 * hanya yang pertama berhasil, sisanya balik `session_expired`, memanggil
 * `clearTokens()`, dan petugas terlempar keluar di tengah pekerjaan.
 */
let inFlightRefresh: Promise<RefreshResult | null> | null = null;

function refreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefreshAccessToken(refreshToken).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function doRefreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
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
    // Bisa jadi pemanggil paralel lain sudah menyegarkan sesi ini sementara
    // kita menunggu; baca ulang sebelum memutuskan sesi benar-benar mati.
    const latest = loadTokens();
    if (latest && latest.accessTokenExp - Math.floor(Date.now() / 1000) >= 300) {
      return latest.accessToken;
    }
    clearTokens();
    return null;
  }
  return tokens.accessToken;
}
