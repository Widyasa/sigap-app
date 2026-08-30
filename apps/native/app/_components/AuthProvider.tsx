import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'expo-router';
import { authReasonToMessage, requestOtp, verifyOtp, baseUrl } from './api';
import { supabase } from './supabase';
import { decodeJwtPayload } from './jwtDecode';
import {
  getAccessToken,
  loadRefreshToken,
  saveRefreshToken,
  clearTokens,
  setAccessToken,
  setAccessTokenChangeHandler,
  refreshAccessToken,
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

/** Rapikan spasi ganda dan seragamkan kapitalisasi nama wilayah. */
function normalizePlaceName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const [{ data: profile, error: profileError }, { data: user, error: userError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, dinas_id, kelurahan, kecamatan, rw')
      .eq('id', userId)
      .single(),
    supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single(),
  ]);

  if (profileError || !profile || userError || !user) {
    console.error('fetch profile error', profileError, userError);
    return null;
  }

  return {
    id: profile.id,
    email: user.email ?? '',
    fullName: profile.full_name,
    role: profile.role,
    dinasId: profile.dinas_id,
    kelurahan: profile.kelurahan,
    kecamatan: profile.kecamatan,
    rw: profile.rw,
  };
}

function getUserIdFromToken(token: string): string {
  const payload = decodeJwtPayload<{ sub?: string }>(token);
  return payload?.sub ?? '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    needsOnboarding: false,
    user: null,
    authError: null,
  });

  const setRealtimeAuth = useCallback((accessToken: string) => {
    // Supabase Realtime memerlukan setAuth eksplisit agar subscription
    // timeline/SOS mengirim access token terbaru; tipe TS publik tidak
    // mengekspos metode ini, jadi kita mengaksesnya lewat boundary yang jelas.
    const realtime = supabase.realtime as unknown as { setAuth: (token: string) => void };
    realtime.setAuth(accessToken);
  }, []);

  useEffect(() => {
    setAccessTokenChangeHandler(setRealtimeAuth);
    return () => {
      setAccessTokenChangeHandler(null);
    };
  }, [setRealtimeAuth]);

  const applySession = useCallback(async (accessToken: string) => {
    const userId = getUserIdFromToken(accessToken);
    if (!userId) {
      await clearTokens();
      setState((s) => ({ ...s, isLoading: false, isAuthenticated: false, user: null }));
      return;
    }

    const user = await fetchUserProfile(userId);
    if (!user) {
      await clearTokens();
      setState((s) => ({ ...s, isLoading: false, isAuthenticated: false, user: null }));
      return;
    }

    setRealtimeAuth(accessToken);
    setState({
      isLoading: false,
      isAuthenticated: true,
      needsOnboarding: !user.kelurahan,
      user,
      authError: null,
    });
  }, [setRealtimeAuth]);

  const loadSession = useCallback(async () => {
    try {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const refreshed = await refreshAccessToken(refreshToken);
      if (!refreshed) {
        await clearTokens();
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      await applySession(refreshed.accessToken);
    } catch (e) {
      console.error('loadSession error', e);
      await clearTokens();
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [applySession]);

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
        if (!result.ok || !result.accessToken || !result.refreshToken) {
          return { ok: false, message: authReasonToMessage(result.reason) };
        }

        setAccessToken(result.accessToken);
        await saveRefreshToken(result.refreshToken);

        const userId = getUserIdFromToken(result.accessToken);
        if (!userId) {
          await clearTokens();
          return { ok: false, message: 'Sesi tidak valid. Coba lagi.' };
        }

        const user = await fetchUserProfile(userId);
        if (!user) {
          await clearTokens();
          return { ok: false, message: 'Gagal memuat profil. Coba lagi.' };
        }

        setRealtimeAuth(result.accessToken);
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
    [setRealtimeAuth],
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
      const refreshToken = await loadRefreshToken();
      if (refreshToken) {
        // `all=true` memanggil Edge Function khusus yang mencabut SEMUA
        // sesi pengguna kecuali sesi perangkat ini — sesuai M6.
        const endpoint = all ? 'auth-signout-all' : 'auth-signout';
        await fetch(`${baseUrl}/functions/v1/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
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
      router.replace('/login');
    }
  }, [router]);

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
