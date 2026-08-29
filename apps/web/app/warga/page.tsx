'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { listCitizenLeaderboard, type CitizenLeaderboardEntry } from '@repo/supabase';
import { colors, typography, spacing } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import { ErrorState, LoadingState } from '../_lib/ui';

const THEME = colors.light;
const WARGA_ROLES = ['verifier', 'dinas_head', 'admin'];

/**
 * Direktori warga (PRD 8.3, `warga/page.tsx` BARU) — daftar warga di
 * kelurahan petugas, dengan poin dan peringkat. Sumber data sama dengan
 * layar leaderboard native (`listCitizenLeaderboard`), difilter 'all'
 * (sepanjang waktu) karena ini direktori, bukan papan peringkat mingguan.
 */
export default function WargaPage() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<CitizenLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!user?.kelurahan) return;
    setError(null);
    try {
      const data = await listCitizenLeaderboard(supabase, user.kelurahan, null, 'all');
      setEntries(data);
    } catch (err) {
      // Pesan mentah PostgREST tidak berarti apa-apa bagi petugas.
      console.error('listCitizenLeaderboard error', err);
      setError('Koneksi sedang terganggu. Coba muat ulang direktori warga.');
    }
  }, [user?.kelurahan]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading || !isAuthenticated || !user) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  if (!WARGA_ROLES.includes(user.role)) {
    return (
      <DashboardShell title="Warga" subtitle="Direktori warga per kelurahan">
        <p style={{ color: THEME.textSecondary }}>Halaman ini tidak tersedia untuk peran Anda.</p>
      </DashboardShell>
    );
  }

  if (!user.kelurahan) {
    return (
      <DashboardShell title="Warga" subtitle="Direktori warga per kelurahan">
        <EmptyState message="Profil Anda belum memiliki kelurahan — direktori warga tidak dapat ditampilkan." />
      </DashboardShell>
    );
  }

  const filtered = (entries ?? []).filter((e) =>
    search.trim() === '' ? true : (e.fullName ?? '').toLowerCase().includes(search.trim().toLowerCase()),
  );

  // Saat `error` terisi, DUA cabang pertama gagal dan eksekusi jatuh ke
  // cabang terakhir — yang merender StatsBar dengan array kosong, sehingga
  // "Total warga 0 · Total poin kumulatif 0" disajikan sebagai fakta di
  // bawah pesan galat. Untuk produk transparansi warga itu kegagalan
  // terburuk yang mungkin.
  if (error) {
    return (
      <DashboardShell title="Warga" subtitle={`Kelurahan ${user.kelurahan}`}>
        <ErrorState message={error} onRetry={load} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Warga"
      subtitle={`Kelurahan ${user.kelurahan}`}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Cari nama warga…',
        label: 'Cari nama warga',
      }}
    >
      {entries === null ? (
        <LoadingState message="Memuat direktori warga…" />
      ) : entries !== null && entries.length === 0 ? (
        <EmptyState message="Belum ada warga terdaftar di kelurahan ini." />
      ) : (
        <>
          <StatsBar entries={entries ?? []} />
          <div style={cardStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Peringkat</Th>
                <Th>Nama</Th>
                <Th>RW</Th>
                <Th>Total Poin</Th>
                <Th>Kontribusi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    {`Tidak ada warga bernama "${search.trim()}" di kelurahan ini.`}
                  </Td>
                </tr>
              ) : null}
              {filtered.map((entry, idx) => {
                const rank = (entries ?? []).findIndex((e) => e.userId === entry.userId) + 1;
                return (
                  <tr key={entry.userId}>
                    <Td>{rank}</Td>
                    <Td>{entry.fullName ?? '—'}</Td>
                    <Td>{entry.rw ?? '—'}</Td>
                    <Td>{entry.totalPoints.toLocaleString('id-ID')}</Td>
                    <Td>{entry.contributionCount}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </DashboardShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ ...cardStyle, padding: spacing(8), textAlign: 'center' }}>
      <p style={{ color: THEME.textSecondary, margin: 0 }}>{message}</p>
    </div>
  );
}

/**
 * Ringkasan statistik warga (PRD 8.3: "Direktori & statistik warga per
 * kelurahan") — total warga, total poin kumulatif, dan rata-rata
 * kontribusi per warga, diturunkan langsung dari `entries` yang sudah
 * dimuat untuk tabel di bawahnya (tidak ada query tambahan). Gaya kartu
 * meniru kartu KPI Ringkasan (`kpiCardStyle` di `app/page.tsx`) untuk
 * konsistensi visual antar halaman.
 */
function StatsBar({ entries }: { entries: CitizenLeaderboardEntry[] }) {
  const totalWarga = entries.length;
  const totalPoin = entries.reduce((sum, e) => sum + e.totalPoints, 0);
  const rataKontribusi = totalWarga > 0
    ? entries.reduce((sum, e) => sum + e.contributionCount, 0) / totalWarga
    : 0;

  return (
    <div style={statsBarStyle}>
      <StatCard label="Total warga" value={totalWarga.toLocaleString('id-ID')} />
      <StatCard label="Total poin kumulatif" value={totalPoin.toLocaleString('id-ID')} />
      <StatCard label="Rata-rata kontribusi" value={rataKontribusi.toLocaleString('id-ID', { maximumFractionDigits: 1 })} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" style={thStyle}>
      {children}
    </th>
  );
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={tdStyle}>
      {children}
    </td>
  );
}

const cardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  overflow: 'hidden',
};

const searchInputStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  padding: `${spacing(2)}px ${spacing(3)}px`,
  borderRadius: 8,
  border: `1px solid ${THEME.border}`,
  width: 280,
  maxWidth: '100%',
  boxSizing: 'border-box',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: typography.micro.fontSize,
  color: THEME.textMuted,
  padding: `${spacing(3)}px ${spacing(4)}px`,
  borderBottom: `1px solid ${THEME.border}`,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const tdStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  color: THEME.textPrimary,
  padding: `${spacing(3)}px ${spacing(4)}px`,
  borderBottom: `1px solid ${THEME.border}`,
};

const statsBarStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: spacing(4),
  marginBottom: spacing(5),
};

const statCardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  padding: spacing(4),
};

const statLabelStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  color: THEME.textMuted,
  marginBottom: spacing(1),
};

const statValueStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: typography.display.fontSize,
  fontWeight: typography.display.fontWeight,
  color: THEME.textPrimary,
};
