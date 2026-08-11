'use client';

import { useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './_lib/auth';
import { NAV_ITEMS } from './_lib/DashboardNav';

const CARD_DESCRIPTIONS: Record<string, string> = {
  '/verifikasi': 'Tinjau antrean aduan warga dan koreksi klasifikasi AI.',
  '/dinas': 'Tindak lanjuti aduan yang sudah diverifikasi dan ditugaskan ke dinas Anda.',
  '/layanan': 'Verifikasi dokumen dan proses permohonan layanan administrasi warga.',
  '/aspirasi': 'Kelola periode voting Musrenbang dan tinjau aspirasi warga.',
  '/anggaran': 'Pantau indeks pencarian anggaran dan tambah item anggaran baru.',
  '/darurat': 'Antrean SOS darurat dengan lokasi peta dan rekaman audio.',
  '/pengumuman': 'Terbitkan pengumuman dan segarkan papan peringkat kelurahan.',
  '/pengguna': 'Kelola akun staf: peran, penugasan dinas, dan status aktif.',
};

/**
 * Landing dashboard staf (issue #14) — pengganti placeholder "Boop". Kartu
 * navigasi disaring dari `NAV_ITEMS` (satu-satunya sumber peran per halaman,
 * dipakai juga oleh `DashboardNav`) supaya daftar di sini tidak pernah diam-
 * diam menyimpang dari nav bar.
 */
export default function DashboardHome() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || !user) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  const cards = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div style={{ width: '100%', maxWidth: 960, padding: 24, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Dashboard SIGAP</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user.fullName ?? user.role} ({ROLE_LABELS[user.role] ?? user.role}).
      </p>

      {cards.length === 0 ? (
        <p style={{ color: '#475569' }}>Belum ada halaman yang tersedia untuk peran Anda.</p>
      ) : (
        <div style={gridStyle}>
          {cards.map((item) => (
            <a key={item.href} href={item.href} style={cardStyle}>
              <h2 style={{ fontSize: 16, marginBottom: 6 }}>{item.label}</h2>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                {CARD_DESCRIPTIONS[item.href]}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  verifier: 'Verifikator',
  dinas_staff: 'Staf Dinas',
  dinas_head: 'Kepala Dinas',
  emergency_operator: 'Operator Darurat',
  admin: 'Admin',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
};

const cardStyle: CSSProperties = {
  display: 'block',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
  textDecoration: 'none',
  color: 'inherit',
  background: '#FFFFFF',
};
