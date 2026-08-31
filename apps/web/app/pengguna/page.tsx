'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { listStaffUsers, setUserDisabled, updateUserRole, type StaffUser } from '@repo/supabase';
import { DINAS_LIST, colors, dinasName, statusColor } from '@repo/shared';
import type { Database } from '@repo/supabase';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import {
  AsyncSection,
  EmptyState,
  FlashMessage,
  Modal,
  TableScroll,
  Td,
  Th,
  buttonStyle as sharedButtonStyle,
  secondaryButtonStyle,
  useFlash,
  visuallyHidden,
} from '../_lib/ui';

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
  const { isLoading: authLoading, isAuthenticated, user, setPassword } = useAuth();
  const router = useRouter();

  const DEFAULT_STAFF_PASSWORD = 'password123';
  const canAccess = user?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!canAccess) {
      // Peran yang salah BUKAN masalah otentikasi. Melemparnya ke /login
      // membuat petugas yang sudah masuk melihat layar masuk, lalu efek di
      // LoginPage langsung memantulkannya kembali — kedip tak berujung.
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { flash, showSuccess } = useFlash();
  /**
   * Perubahan peran dulu langsung ditulis pada event `onChange` dropdown:
   * satu salah klik cukup untuk menurunkan admin lain menjadi warga, atau
   * menaikkan siapa pun menjadi admin, tanpa konfirmasi dan tanpa undo —
   * sementara "hapus pengumuman" yang jauh lebih ringan justru punya dialog
   * konfirmasi. Sekarang setiap perubahan lewat konfirmasi eksplisit yang
   * menyebut nama pengguna, peran barunya, dan dinas tujuannya.
   */
  const [pendingRole, setPendingRole] = useState<{ target: StaffUser; role: UserRole; dinasId: string | null } | null>(null);
  const [pendingDisable, setPendingDisable] = useState<StaffUser | null>(null);
  const [pendingSetPassword, setPendingSetPassword] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bulkPasswordOpen, setBulkPasswordOpen] = useState(false);
  const [bulkPasswordBusy, setBulkPasswordBusy] = useState(false);

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

  const applyDisable = async (target: StaffUser) => {
    setBusyId(target.id);
    setError(null);
    try {
      const disable = target.disabledAt === null;
      await setUserDisabled(supabase, target.id, disable);
      showSuccess(
        disable
          ? `Akun ${target.fullName ?? target.email} dinonaktifkan dan seluruh sesinya dicabut.`
          : `Akun ${target.fullName ?? target.email} diaktifkan kembali.`,
      );
      await load();
    } catch (e) {
      console.error('setUserDisabled error', e);
      setError('Gagal mengubah status akun. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const applyRoleChange = async (target: StaffUser, role: UserRole, dinasId: string | null) => {
    setBusyId(target.id);
    setError(null);
    try {
      await updateUserRole(supabase, target.id, role, dinasId);
      showSuccess(`Peran ${target.fullName ?? target.email} diubah menjadi ${ROLE_LABELS[role]}.`);
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

  const applySetPassword = async (target: StaffUser) => {
    setBusyId(target.id);
    setError(null);
    if (newPassword.length < 8) {
      setError('Password minimal 8 karakter.');
      setBusyId(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password dan konfirmasi tidak cocok.');
      setBusyId(null);
      return;
    }
    try {
      const result = await setPassword(target.email, newPassword);
      if (!result.ok) throw new Error(result.message);
      showSuccess(`Password untuk ${target.fullName ?? target.email} berhasil diatur.`);
      setPendingSetPassword(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      console.error('setPassword error', e);
      setError('Gagal mengatur password. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  };

  const applyBulkDefaultPasswords = async () => {
    if (DEFAULT_STAFF_PASSWORD.length < 8) {
      setError('Password default tidak valid.');
      return;
    }
    setBulkPasswordBusy(true);
    setError(null);
    try {
      const staff = users.filter((u) => u.role !== 'citizen');
      if (staff.length === 0) {
        setError('Tidak ada akun staff untuk diatur passwordnya.');
        setBulkPasswordBusy(false);
        return;
      }
      let success = 0;
      let failed = 0;
      for (const u of staff) {
        try {
          const result = await setPassword(u.email, DEFAULT_STAFF_PASSWORD);
          if (result.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      }
      showSuccess(`Password default berhasil diatur untuk ${success} akun.${failed > 0 ? ` ${failed} gagal.` : ''}`);
      setBulkPasswordOpen(false);
    } catch (e) {
      console.error('bulk default password error', e);
      setError('Gagal mengatur password default. Coba lagi.');
    } finally {
      setBulkPasswordBusy(false);
    }
  };

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  return (
    <DashboardShell
      title="Kelola Pengguna"
      // Hitungan hanya ditampilkan setelah data benar-benar termuat; dulu
      // subjudul selalu berbunyi "0 akun terdaftar." selama memuat dan
      // setelah gagal.
      subtitle={
        loading || error
          ? `Masuk sebagai ${user?.fullName ?? user?.role}.`
          : `Masuk sebagai ${user?.fullName ?? user?.role}. ${users.length} akun terdaftar.`
      }
      actions={
        <button
          type="button"
          style={smallButtonStyle}
          disabled={loading || bulkPasswordBusy}
          onClick={() => setBulkPasswordOpen(true)}
        >
          Password Default Staff
        </button>
      }
    >
      <FlashMessage flash={flash} />

      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : users}
        onRetry={load}
        loadingMessage="Memuat daftar akun…"
        empty={
          <EmptyState
            icon="👥"
            title="Belum ada akun terdaftar"
            message="Akun dibuat otomatis saat seseorang masuk untuk pertama kali dengan alamat emailnya."
          />
        }
      >
        {(rows) => (
        <TableScroll caption="Daftar akun pengguna dan perannya">
          <thead>
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Peran</Th>
              <Th>Dinas</Th>
              <Th>Kelurahan</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <Td>{u.fullName}</Td>
                <Td>{u.email}</Td>
                <Td>
                  <label htmlFor={`peran-${u.id}`} style={visuallyHidden}>
                    Peran untuk {u.fullName ?? u.email}
                  </label>
                  <select
                    id={`peran-${u.id}`}
                    style={selectStyle}
                    value={u.role}
                    // Admin tidak boleh menurunkan perannya sendiri: satu-satunya
                    // admin yang melakukannya mengunci semua orang dari
                    // manajemen pengguna, dan pemulihannya butuh service-role key.
                    disabled={busyId === u.id || u.id === user?.id}
                    title={u.id === user?.id ? 'Tidak dapat mengubah peran akun sendiri' : undefined}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setPendingRole({
                        target: u,
                        role,
                        dinasId: ROLE_NEEDS_DINAS.includes(role) ? u.dinasId ?? DINAS_LIST[0]?.id ?? null : null,
                      });
                    }}
                  >
                    {ROLE_VALUES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  {ROLE_NEEDS_DINAS.includes(u.role) ? (
                    <>
                      <label htmlFor={`dinas-${u.id}`} style={visuallyHidden}>
                        Dinas untuk {u.fullName ?? u.email}
                      </label>
                      <select
                        id={`dinas-${u.id}`}
                        style={selectStyle}
                        value={u.dinasId ?? ''}
                        disabled={busyId === u.id}
                        onChange={(e) => handleDinasChange(u, e.target.value)}
                      >
                        {/* Opsi kosong eksplisit: tanpa ini `value=''` tidak
                            cocok dengan opsi mana pun dan peramban menampilkan
                            dinas PERTAMA, sehingga admin tidak punya cara
                            melihat bahwa penugasan dinasnya sebenarnya kosong. */}
                        <option value="">— Belum ditugaskan —</option>
                        {DINAS_LIST.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    dinasName(u.dinasId)
                  )}
                </Td>
                <Td>{u.kelurahan ?? '-'}</Td>
                <Td>
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
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={smallButtonStyle}
                      disabled={busyId === u.id || u.id === user?.id || u.role === 'citizen'}
                      onClick={() => setPendingSetPassword(u)}
                      title={u.role === 'citizen' ? 'Password tidak diizinkan untuk warga' : undefined}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      style={smallButtonStyle}
                      disabled={busyId === u.id || u.id === user?.id}
                      onClick={() => setPendingDisable(u)}
                      title={u.id === user?.id ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                    >
                      {busyId === u.id ? 'Menyimpan…' : u.disabledAt ? 'Aktifkan' : 'Nonaktifkan'}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
        )}
      </AsyncSection>

      {pendingRole ? (
        <Modal title="Ubah peran pengguna" onClose={() => setPendingRole(null)}>
          <p style={{ marginTop: 0 }}>
            Ubah peran <strong>{pendingRole.target.fullName ?? pendingRole.target.email}</strong> menjadi{' '}
            <strong>{ROLE_LABELS[pendingRole.role]}</strong>?
          </p>
          {ROLE_NEEDS_DINAS.includes(pendingRole.role) ? (
            <>
              <label htmlFor="konfirmasi-dinas" style={{ display: 'block', marginBottom: 4 }}>
                Dinas penugasan
              </label>
              <select
                id="konfirmasi-dinas"
                style={{ ...selectStyle, width: '100%' }}
                value={pendingRole.dinasId ?? ''}
                onChange={(e) => setPendingRole({ ...pendingRole, dinasId: e.target.value || null })}
              >
                <option value="">— Pilih dinas —</option>
                {DINAS_LIST.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 13, color: THEME.textSecondary }}>
                Peran ini langsung memperoleh hak tulis atas antrean aduan dinas tersebut.
              </p>
            </>
          ) : null}
          <p style={{ fontSize: 13, color: THEME.textSecondary }}>
            Seluruh sesi aktif pengguna ini akan dicabut sehingga peran barunya langsung berlaku.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setPendingRole(null)}>
              Batal
            </button>
            <button
              type="button"
              style={sharedButtonStyle}
              disabled={ROLE_NEEDS_DINAS.includes(pendingRole.role) && !pendingRole.dinasId}
              onClick={() => {
                const p = pendingRole;
                setPendingRole(null);
                void applyRoleChange(p.target, p.role, p.dinasId);
              }}
            >
              Ubah Peran
            </button>
          </div>
        </Modal>
      ) : null}

      {pendingDisable ? (
        <Modal
          title={pendingDisable.disabledAt ? 'Aktifkan akun' : 'Nonaktifkan akun'}
          onClose={() => setPendingDisable(null)}
        >
          <p style={{ marginTop: 0 }}>
            {pendingDisable.disabledAt
              ? `Aktifkan kembali akun ${pendingDisable.fullName ?? pendingDisable.email}?`
              : `Nonaktifkan akun ${pendingDisable.fullName ?? pendingDisable.email}? Seluruh sesi aktifnya akan langsung dicabut.`}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setPendingDisable(null)}>
              Batal
            </button>
            <button
              type="button"
              style={sharedButtonStyle}
              onClick={() => {
                const t = pendingDisable;
                setPendingDisable(null);
                void applyDisable(t);
              }}
            >
              {pendingDisable.disabledAt ? 'Aktifkan' : 'Nonaktifkan'}
            </button>
          </div>
        </Modal>
      ) : null}

      {pendingSetPassword ? (
        <Modal title="Atur Password" onClose={() => { setPendingSetPassword(null); setNewPassword(''); setConfirmPassword(''); }}>
          <p style={{ marginTop: 0 }}>
            Atur password baru untuk <strong>{pendingSetPassword.fullName ?? pendingSetPassword.email}</strong>.
          </p>
          <label htmlFor="new-password" style={{ display: 'block', marginBottom: 4, fontSize: 13, color: THEME.textSecondary }}>
            Password baru
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ ...selectStyle, width: '100%', marginBottom: 12, minHeight: 36, padding: '0 10px' }}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
          <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: 4, fontSize: 13, color: THEME.textSecondary }}>
            Konfirmasi password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ ...selectStyle, width: '100%', marginBottom: 12, minHeight: 36, padding: '0 10px' }}
            placeholder="Ketik ulang password"
            autoComplete="new-password"
          />
          {error ? <p style={{ color: THEME.danger, fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => { setPendingSetPassword(null); setNewPassword(''); setConfirmPassword(''); }}>
              Batal
            </button>
            <button
              type="button"
              style={sharedButtonStyle}
              disabled={busyId === pendingSetPassword.id}
              onClick={() => {
                const t = pendingSetPassword;
                void applySetPassword(t);
              }}
            >
              {busyId === pendingSetPassword.id ? 'Menyimpan…' : 'Simpan Password'}
            </button>
          </div>
        </Modal>
      ) : null}

      {bulkPasswordOpen ? (
        <Modal title="Password Default untuk Staff" onClose={() => setBulkPasswordOpen(false)}>
          <p style={{ marginTop: 0 }}>
            Atur password semua akun staff (non-warga) menjadi <strong>{DEFAULT_STAFF_PASSWORD}</strong>.
            Tindakan ini berguna untuk demo/development dan harus segera diubah setelahnya.
          </p>
          <p style={{ fontSize: 13, color: THEME.textSecondary }}>
            Akun terdampak: {users.filter((u) => u.role !== 'citizen').length} staff.
          </p>
          {error ? <p style={{ color: THEME.danger, fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setBulkPasswordOpen(false)}>
              Batal
            </button>
            <button
              type="button"
              style={sharedButtonStyle}
              disabled={bulkPasswordBusy}
              onClick={() => void applyBulkDefaultPasswords()}
            >
              {bulkPasswordBusy ? 'Menerapkan…' : 'Terapkan Password Default'}
            </button>
          </div>
        </Modal>
      ) : null}
    </DashboardShell>
  );
}

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
