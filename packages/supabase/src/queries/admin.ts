import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type UserRole = Database['public']['Enums']['user_role'];

export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  dinasId: string | null;
  kelurahan: string | null;
  disabledAt: string | null;
}

interface StaffUserRow {
  id: string;
  full_name: string;
  role: UserRole;
  dinas_id: string | null;
  kelurahan: string | null;
  users: { email: string; disabled_at: string | null } | null;
}

const STAFF_USER_COLUMNS =
  'id, full_name, role, dinas_id, kelurahan, users:id ( email, disabled_at )';

/**
 * Seluruh pengguna untuk manajemen admin (kriteria "Admin manages users").
 * RLS `profiles_read` mengizinkan semua baca profiles, dan `users_admin_read`
 * mengizinkan admin membaca email di tabel `users` — join lewat foreign key
 * `profiles.id -> users.id` bekerja karena PostgREST menegakkan RLS per
 * tabel yang di-join, bukan hanya tabel utama.
 */
export async function listStaffUsers(supabase: SupabaseClient<Database>): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select<string, StaffUserRow>(STAFF_USER_COLUMNS)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.users?.email ?? '',
    fullName: row.full_name,
    role: row.role,
    dinasId: row.dinas_id,
    kelurahan: row.kelurahan,
    disabledAt: row.users?.disabled_at ?? null,
  }));
}

/**
 * Admin menonaktifkan/mengaktifkan akun lewat RPC SECURITY DEFINER
 * `disable_user` (migrasi 20260812000001_admin_users.sql) — `users` tidak
 * punya policy UPDATE sama sekali, jadi tidak ada jalur RLS langsung.
 */
export async function setUserDisabled(
  supabase: SupabaseClient<Database>,
  userId: string,
  disabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('disable_user', { p_user_id: userId, p_disabled: disabled });
  if (error) throw error;
}

/**
 * Admin mengubah peran/penugasan dinas pengguna lain lewat RPC SECURITY
 * DEFINER `set_user_role` (migrasi 20260816000002_security_hardening.sql).
 *
 * Dulu ini UPDATE langsung ke `profiles` lewat RLS `profiles_admin_all`.
 * Masalahnya, peran ikut tercetak sebagai klaim `app_role` di access token
 * dan dipercaya oleh Edge Function `generate-service-pdf`, sehingga
 * penurunan peran tidak berlaku sampai token lama kedaluwarsa. RPC-nya
 * mencabut seluruh sesi pengguna itu dalam transaksi yang sama.
 */
export async function updateUserRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
  dinasId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_user_role', {
    p_user_id: userId,
    p_role: role,
    p_dinas_id: dinasId,
  });
  if (error) throw error;
}
