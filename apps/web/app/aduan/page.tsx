'use client';

import { Suspense, useEffect, useMemo, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { colors } from '@repo/shared';
import { useAuth, type StaffProfile } from '../_lib/auth';
import { DashboardShell } from '../_lib/DashboardShell';
import { VerifikasiTab } from './_verifikasiTab';
import { DinasTab } from './_dinasTab';

const THEME = colors.light;
const ADUAN_ROLES = ['verifier', 'dinas_staff', 'dinas_head', 'admin'];

type TabKey = 'verifikasi' | 'dinas';

/**
 * Antrean aduan gabungan (Fase 2, "Q2: Merge /verifikasi + /dinas -> single
 * /aduan route with role-based tabs"). Verifier hanya melihat tab
 * Verifikasi, dinas_staff/dinas_head hanya tab Dinas — keduanya tidak
 * pernah punya akses ke tab lain, jadi tab bar itu sendiri hanya dirender
 * untuk admin (satu-satunya peran yang butuh berpindah tab).
 */
export default function AduanPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && ADUAN_ROLES.includes(user.role);

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

  if (authLoading || !isAuthenticated || !canAccess || !user) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Memuat…</div>}>
      <AduanContent user={user} />
    </Suspense>
  );
}

function AduanContent({ user }: { user: StaffProfile }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const accessibleTabs = useMemo<TabKey[]>(() => {
    if (user.role === 'admin') return ['verifikasi', 'dinas'];
    if (user.role === 'verifier') return ['verifikasi'];
    return ['dinas'];
  }, [user.role]);

  const requestedTab = searchParams.get('tab');
  const activeTab: TabKey =
    requestedTab === 'verifikasi' || requestedTab === 'dinas'
      ? accessibleTabs.includes(requestedTab)
        ? requestedTab
        : accessibleTabs[0]
      : accessibleTabs[0];

  const setActiveTab = (tab: TabKey) => {
    router.replace(`/aduan?tab=${tab}`, { scroll: false });
  };

  return (
    <DashboardShell title="Aduan" subtitle={`Masuk sebagai ${user.fullName ?? user.role}.`}>
      {accessibleTabs.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {/* Keadaan terpilih DULU hanya lewat warna latar. Pola tombol
              alih (`aria-pressed`) lebih tepat daripada ARIA tabs penuh di
              sini: panelnya sederhana dan hanya ada dua. */}
          <button
            type="button"
            aria-pressed={activeTab === 'verifikasi'}
            style={activeTab === 'verifikasi' ? { ...tabButtonStyle, ...tabButtonActiveStyle } : tabButtonStyle}
            onClick={() => setActiveTab('verifikasi')}
          >
            Verifikasi
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'dinas'}
            style={activeTab === 'dinas' ? { ...tabButtonStyle, ...tabButtonActiveStyle } : tabButtonStyle}
            onClick={() => setActiveTab('dinas')}
          >
            Dinas
          </button>
        </div>
      ) : null}

      {activeTab === 'verifikasi' ? <VerifikasiTab user={user} /> : <DinasTab user={user} />}
    </DashboardShell>
  );
}

const tabButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 16px',
  borderRadius: 6,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface,
  color: THEME.textPrimary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const tabButtonActiveStyle: CSSProperties = {
  background: THEME.primary,
  color: THEME.surface,
  border: `1px solid ${THEME.primary}`,
};
