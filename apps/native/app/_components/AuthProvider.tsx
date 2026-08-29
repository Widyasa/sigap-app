import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { authReasonToMessage, requestOtp, verifyOtp, baseUrl } from './api';
import { supabase } from './supabase';
import { decodeJwtPayload } from './jwtDecode';
import {
  getAccessToken,
  loadTokens,
  saveTokens,
  clearTokens,
  getTokenExpiry,
} from './session';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  dinasId: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  rw: string | null;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  user: UserProfile | null;
  authError: string | null;
}

interface AuthActions {
  requestOtp: (email: string) => Promise<{
    ok: boolean;
    message?: string;
    devCode?: string;
    retryAfterSeconds?: number;
  }>;
  verifyOtp: (email: string, code: string) => Promise<{ ok: boolean; message?: string; needsOnboarding?: boolean }>;
  completeOnboarding: (input: OnboardingInput) => Promise<{ ok: boolean; message?: string }>;
  signOut: (all?: boolean) => Promise<void>;
  clearError: () => void;
  getAccessToken: () => Promise<string | null>;
}

type AuthContextValue = AuthState & AuthActions;

export interface OnboardingInput {
  fullName: string;
  kecamatan: string;
  kelurahan: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_KEY = 'sigap_user_profile';

/** Rapikan spasi ganda dan seragamkan kapitalisasi nama wilayah. */
function normalizePlaceName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    needsOnboarding: false,
    user: null,
    authError: null,
  });

  const loadSession = useCallback(async () => {
    try {
      const tokens = await loadTokens();
      if (!tokens) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const accessToken = await getAccessToken();
      if (!accessToken) {
        await clearTokens();
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      // Validate token by fetching own profile.
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, dinas_id, kelurahan, kecamatan, rw')
        .eq('id', getUserIdFromToken(accessToken))
        .single();

      if (error || !profile) {
        await clearTokens();
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const user = profileToUser(profile);
      setState({
        isLoading: false,
        isAuthenticated: true,
        needsOnboarding: !user.kelurahan,
        user,
        authError: null,
      });
    } catch (e) {
      console.error('loadSession error', e);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const requestOtpAction = useCallback(
    async (email: string) => {
      setState((s) => ({ ...s, authError: null }));
      try {
        const result = await requestOtp(email);
        if (!result.ok) {
          return {
            ok: false,
            message: authReasonToMessage(result.reason),
            retryAfterSeconds: result.retry_after_seconds,
          };
        }
        return { ok: true, devCode: result.devCode };
      } catch (e) {
        console.error('requestOtp error', e);
        return { ok: false, message: 'Gagal mengirim kode. Periksa koneksi internet.' };
      }
    },
    [],
  );

  const verifyOtpAction = useCallback(
    async (email: string, code: string) => {
      setState((s) => ({ ...s, authError: null }));
      try {
        const result = await verifyOtp(email, code);
        if (!result.ok || !result.accessToken || !result.refreshToken || !result.user) {
          return { ok: false, message: authReasonToMessage(result.reason) };
        }
        await saveTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExp: getTokenExpiry(result.accessToken),
        });
        const user: UserProfile = {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.profile.fullName,
          role: result.user.profile.role,
          dinasId: result.user.profile.dinasId,
          kelurahan: result.user.profile.kelurahan,
          kecamatan: result.user.profile.kecamatan,
          rw: result.user.profile.rw,
        };
        setState({
          isLoading: false,
          isAuthenticated: true,
          needsOnboarding: !user.kelurahan,
          user,
          authError: null,
        });
        return { ok: true, needsOnboarding: !user.kelurahan };
      } catch (e) {
        console.error('verifyOtp error', e);
        return { ok: false, message: 'Gagal memverifikasi kode. Periksa koneksi internet.' };
      }
    },
    [],
  );

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      const { fullName, kecamatan, kelurahan } = input;
      if (!fullName.trim() || !kecamatan.trim() || !kelurahan.trim()) {
        return { ok: false, message: 'Semua kolom wajib diisi.' };
      }
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          return { ok: false, message: 'Sesi tidak ditemukan. Masuk kembali.' };
        }
        const userId = getUserIdFromToken(accessToken);
        // Kelurahan dinormalkan sebelum disimpan.
        //
        // Nilai ini dibandingkan PERSIS (string equality) oleh
        // `votes_insert_own` dan oleh setiap query yang discope per
        // kelurahan. Tanpa normalisasi, warga yang mengetik "sukamaju" atau
        // "Suka  Maju" diam-diam melihat daftar aspirasi kosong dan tidak
        // akan pernah bisa memilih, tanpa satu pun penjelasan di layar.
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim().replace(/\s+/g, ' '),
            kecamatan: normalizePlaceName(kecamatan),
            kelurahan: normalizePlaceName(kelurahan),
          })
          .eq('id', userId);
        if (error) {
          console.error('update profile error', error);
          return { ok: false, message: 'Gagal menyimpan profil. Coba lagi.' };
        }
        setState((s) => ({
          ...s,
          needsOnboarding: false,
          user: s.user
            ? {
                ...s.user,
                fullName: fullName.trim(),
                kecamatan: kecamatan.trim(),
                kelurahan: kelurahan.trim(),
              }
            : null,
        }));
        return { ok: true };
      } catch (e) {
        console.error('completeOnboarding error', e);
        return { ok: false, message: 'Terjadi kesalahan. Coba lagi.' };
      }
    },
    [],
  );

  const signOut = useCallback(async (all = false) => {
    try {
      const refreshToken = (await loadTokens())?.refreshToken;
      if (refreshToken) {
        // Sama seperti session.ts: dulu ini menembak
        // "undefined/functions/v1/auth-signout", jadi token lokal terhapus
        // tapi `auth_sessions.revoked_at` tetap NULL — refresh token yang
        // sudah "keluar" masih sah selama 30 hari.
        await fetch(`${baseUrl}/functions/v1/auth-signout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, all }),
        });
      }
    } catch (e) {
      console.error('signOut error', e);
    } finally {
      await clearTokens();
      setState({
        isLoading: false,
        isAuthenticated: false,
        needsOnboarding: false,
        user: null,
        authError: null,
      });
    }
  }, []);

  const clearError = useCallback(
    () => setState((s) => ({ ...s, authError: null })),
    [],
  );

  const value: AuthContextValue = {
    ...state,
    requestOtp: requestOtpAction,
    verifyOtp: verifyOtpAction,
    completeOnboarding,
    signOut,
    clearError,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

function getUserIdFromToken(token: string): string {
  const payload = decodeJwtPayload<{ sub?: string }>(token);
  return payload?.sub ?? '';
}

function profileToUser(profile: {
  id: string;
  full_name: string | null;
  role: string;
  dinas_id: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  rw: string | null;
}): UserProfile {
  return {
    id: profile.id,
    email: '',
    fullName: profile.full_name,
    role: profile.role,
    dinasId: profile.dinas_id,
    kelurahan: profile.kelurahan,
    kecamatan: profile.kecamatan,
    rw: profile.rw,
  };
}
