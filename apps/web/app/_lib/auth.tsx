'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { authReasonToMessage, requestOtp, verifyOtp as verifyOtpRequest, signOut as signOutRequest } from './api';
import { supabase } from './supabaseClient';
import { decodeJwtPayload } from './jwtDecode';
import { getAccessToken, loadTokens, saveTokens, clearTokens, getTokenExpiry } from './session';

export interface StaffProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  dinasId: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: StaffProfile | null;
}

interface AuthContextValue extends AuthState {
  requestOtp: (email: string) => Promise<{ ok: boolean; message?: string; devCode?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getUserIdFromToken(token: string): string {
  const payload = decodeJwtPayload<{ sub?: string }>(token);
  return payload?.sub ?? '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
  });

  const loadSession = useCallback(async () => {
    const tokens = loadTokens();
    if (!tokens) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      clearTokens();
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, dinas_id, kelurahan, kecamatan')
      .eq('id', getUserIdFromToken(accessToken))
      .single();
    if (error || !profile) {
      clearTokens();
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: profile.id,
        email: '',
        fullName: profile.full_name,
        role: profile.role,
        dinasId: profile.dinas_id,
        kelurahan: profile.kelurahan,
        kecamatan: profile.kecamatan,
      },
    });
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const requestOtpAction = useCallback(async (email: string) => {
    try {
      const result = await requestOtp(email);
      if (!result.ok) return { ok: false, message: authReasonToMessage(result.reason) };
      return { ok: true, devCode: result.devCode };
    } catch (e) {
      console.error('requestOtp error', e);
      return { ok: false, message: 'Gagal mengirim kode. Periksa koneksi internet.' };
    }
  }, []);

  const verifyOtpAction = useCallback(async (email: string, code: string) => {
    try {
      const result = await verifyOtpRequest(email, code);
      if (!result.ok || !result.accessToken || !result.refreshToken || !result.user) {
        return { ok: false, message: authReasonToMessage(result.reason) };
      }
      saveTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExp: getTokenExpiry(result.accessToken),
      });
      setState({
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.profile.fullName,
          role: result.user.profile.role,
          dinasId: result.user.profile.dinasId,
          kelurahan: result.user.profile.kelurahan,
          kecamatan: result.user.profile.kecamatan,
        },
      });
      return { ok: true };
    } catch (e) {
      console.error('verifyOtp error', e);
      return { ok: false, message: 'Gagal memverifikasi kode. Periksa koneksi internet.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const refreshToken = loadTokens()?.refreshToken;
      if (refreshToken) await signOutRequest(refreshToken);
    } catch (e) {
      console.error('signOut error', e);
    } finally {
      clearTokens();
      setState({ isLoading: false, isAuthenticated: false, user: null });
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    requestOtp: requestOtpAction,
    verifyOtp: verifyOtpAction,
    signOut,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
