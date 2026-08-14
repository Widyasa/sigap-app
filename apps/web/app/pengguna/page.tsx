'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { listStaffUsers, setUserDisabled, updateUserRole, type StaffUser } from '@repo/supabase';
import { DINAS_LIST, colors, statusColor } from '@repo/shared';
import type { Database } from '@repo/supabase';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';

const THEME = colors.light;

type UserRole = Database['public']['Enums']['user_role'];

const ROLE_VALUES: UserRole[] = [
  'citizen',
  'verifier',
  'dinas_staff',
  'dinas_head',
  'emergency_operator',
  'admin',
];

const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Warga',
  verifier: 'Verifikator',
  dinas_staff: 'Staf Dinas',
  dinas_head: 'Kepala Dinas',
  emergency_operator: 'Operator Darurat',
  admin: 'Admin',
};

const ROLE_NEEDS_DINAS: UserRole[] = ['dinas_staff', 'dinas_head'];

/**
 * Manajemen pengguna admin (issue #14, kriteria "Admin manages users").
 * Peran diubah lewat UPDATE langsung ke `profiles` (RLS `profiles_admin_all`
 * mengizinkan admin menulis baris siapa pun); nonaktif/aktifkan akun lewat
 * RPC `disable_user` karena `users` tidak punya policy UPDATE sama sekali
 * (lihat `packages/supabase/src/queries/admin.ts`).
 */
export default function PenggunaPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = user?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listStaffUsers(supabase);
      setUsers(list);
    } catch (e) {
      console.error('listStaffUsers error', e);
      setError('Gagal memuat data pengguna. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  const handleToggleDisabled = async (target: StaffUser) => {
    setBusyId(target.id);
    setError(null);
    try {
      await setUserDisabled(supabase, target.id, target.disabledAt === null);
      await load();
    } catch (e) {
      console.error('setUserDisabled error', e);
      setError('Gagal mengubah status akun. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (target: StaffUser, role: UserRole) => {
    setBusyId(target.id);
    setError(null);
    try {
      const dinasId = ROLE_NEEDS_DINAS.includes(role) ? (target.dinasId ?? DINAS_LIST[0]?.id ?? null) : null;
      await updateUserRole(supabase, target.id, role, dinasId);
      await load();
    } catch (e) {
      console.error('updateUserRole error', e);
      setError('Gagal mengubah peran. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDinasChange = async (target: StaffUser, dinasId: string) => {
    setBusyId(target.id);
    setError(null);
    try {
      await updateUserRole(supabase, target.id, target.role, dinasId);
      await load();
    } catch (e) {
      console.error('updateUserRole error', e);
      setError('Gagal mengubah dinas. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  return (
    <DashboardShell
      title="Kelola Pengguna"
      subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}. ${users.length} akun terdaftar.`}
    >
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}

      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nama</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Peran</th>
              <th style={thStyle}>Dinas</th>
              <th style={thStyle}>Kelurahan</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.fullName}</td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>
                  <select
                    style={selectStyle}
                    value={u.role}
                    disabled={busyId === u.id}
                    onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                  >
                    {ROLE_VALUES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  {ROLE_NEEDS_DINAS.includes(u.role) ? (
                    <select
                      style={selectStyle}
                      value={u.dinasId ?? ''}
                      disabled={busyId === u.id}
                      onChange={(e) => handleDinasChange(u, e.target.value)}
                    >
                      {DINAS_LIST.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    u.dinasId ?? '-'
                  )}
                </td>
                <td style={tdStyle}>{u.kelurahan ?? '-'}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      color: u.disabledAt ? THEME.danger : statusColor('resolved', 'light').fg,
                      background: u.disabledAt ? THEME.dangerSurface : statusColor('resolved', 'light').bg,
                    }}
                  >
                    {u.disabledAt ? 'Nonaktif' : 'Aktif'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <button
                    style={smallButtonStyle}
                    disabled={busyId === u.id || u.id === user?.id}
                    onClick={() => handleToggleDisabled(u)}
                    title={u.id === user?.id ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                  >
                    {busyId === u.id ? 'Menyimpan…' : u.disabledAt ? 'Aktifkan' : 'Nonaktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardShell>
  );
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: `2px solid ${THEME.border}`,
  padding: '8px 6px',
  fontSize: 12,
  color: THEME.textSecondary,
  textTransform: 'uppercase',
};
const tdStyle: CSSProperties = { borderBottom: `1px solid ${THEME.border}`, padding: '8px 6px' };
const selectStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 13,
};
const smallButtonStyle: CSSProperties = {
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 6,
  border: 'none',
  background: THEME.primary,
  color: THEME.surface,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
