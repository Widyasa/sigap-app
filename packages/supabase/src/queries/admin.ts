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
 * Admin mengubah peran/penugasan dinas pengguna lain. RLS `profiles_admin_all`
 * sudah mengizinkan admin menulis baris profiles siapa pun tanpa syarat
 * tambahan (berbeda dari `profiles_self_update` yang mengunci kolom role),
 * jadi ini UPDATE langsung, bukan RPC.
 */
export async function updateUserRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
  dinasId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, dinas_id: dinasId })
    .eq('id', userId);
  if (error) throw error;
}
