import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

// ---------------------------------------------------------------------
// Active device sessions (M6 INFO & KOMUNITAS — profile)
// ---------------------------------------------------------------------

export interface MySession {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string;
}

interface SessionRow {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string;
}

/**
 * Daftar sesi aktif milik pengguna, terbaru menurut `last_used_at`.
 * Hanya membaca kolom non-sensitif; hash refresh token TIDAK diambil.
 */
export async function listMySessions(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MySession[]> {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select<string, SessionRow>('id, device_label, created_at, last_used_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    deviceLabel: row.device_label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

/**
 * Mencabut satu sesi aktif lewat Edge Function `auth-revoke-session`.
 * Client tidak boleh UPDATE `auth_sessions` langsung karena tidak ada
 * policy UPDATE (pencabutan selalu lewat Edge Function).
 */
export async function revokeSession(
  supabaseUrl: string,
  accessToken: string,
  sessionId: string,
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/auth-revoke-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await response.json()) as { ok?: boolean; reason?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.reason ?? 'Gagal mencabut sesi perangkat.');
  }
}
