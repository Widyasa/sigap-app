'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listAnnouncementsForAdmin,
  createAnnouncement,
  deleteAnnouncement,
  refreshLeaderboard,
  listLeaderboard,
  type Announcement,
  type KelurahanLeaderboardEntry,
} from '@repo/supabase';
import { createAnnouncementSchema, ANNOUNCEMENT_CATEGORIES } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';

export default function PengumumanAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = user?.role === 'admin' || user?.role === 'dinas_head';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [leaderboard, setLeaderboard] = useState<KelurahanLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [announcementList, leaderboardList] = await Promise.all([
        listAnnouncementsForAdmin(supabase),
        listLeaderboard(supabase),
      ]);
      setAnnouncements(announcementList);
      setLeaderboard(leaderboardList);
    } catch (e) {
      console.error('load admin pengumuman error', e);
      setError('Gagal memuat data. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: 960, padding: 24, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Info & Komunitas</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user?.fullName ?? user?.role}.
      </p>

      {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <>
          <AnnouncementsSection announcements={announcements} onChanged={load} />
          <LeaderboardSection leaderboard={leaderboard} onRefreshed={load} />
        </>
      )}
    </div>
  );
}

function AnnouncementsSection({
  announcements,
  onChanged,
}: {
  announcements: Announcement[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'kelurahan'>('all');
  const [kelurahan, setKelurahan] = useState('');
  const [category, setCategory] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user } = useAuth();

  const handleCreate = async () => {
    setFormError(null);
    if (!user?.id) return;

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (attachmentFile) {
      setSubmitting(true);
      try {
        const path = `${user.id}/${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(path, attachmentFile, { contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        attachmentUrl = supabase.storage.from('announcement-attachments').getPublicUrl(path).data.publicUrl;
        attachmentName = attachmentFile.name;
      } catch (e) {
        console.error('upload attachment error', e);
        setFormError('Gagal mengunggah lampiran PDF. Coba lagi.');
        setSubmitting(false);
        return;
      }
    }

    const parsed = createAnnouncementSchema.safeParse({
      title,
      body,
      kelurahan: target === 'kelurahan' ? kelurahan.trim() : undefined,
      category: category || undefined,
      attachmentUrl,
      attachmentName,
      isPinned,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data pengumuman tidak valid.');
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    try {
      await createAnnouncement(supabase, parsed.data, user.id);
      setTitle('');
      setBody('');
      setKelurahan('');
      setCategory('');
      setAttachmentFile(null);
      setIsPinned(false);
      setTarget('all');
      onChanged();
    } catch (e) {
      console.error('createAnnouncement error', e);
      setFormError('Gagal membuat pengumuman. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAnnouncement(supabase, id);
      onChanged();
    } catch (e) {
      console.error('deleteAnnouncement error', e);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Pengumuman</h2>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Judul</th>
            <th style={thStyle}>Target</th>
            <th style={thStyle}>Kategori</th>
            <th style={thStyle}>Lampiran</th>
            <th style={thStyle}>Pin</th>
            <th style={thStyle}>Terbit</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {announcements.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={7}>
                Belum ada pengumuman.
              </td>
            </tr>
          ) : (
            announcements.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>{a.title}</td>
                <td style={tdStyle}>{a.kelurahan ?? 'Semua warga'}</td>
                <td style={tdStyle}>
                  {ANNOUNCEMENT_CATEGORIES.find((c) => c.id === a.category)?.label ?? '-'}
                </td>
                <td style={tdStyle}>
                  {a.attachmentUrl ? (
                    <a href={a.attachmentUrl} target="_blank" rel="noreferrer">
                      {a.attachmentName ?? 'Unduh'}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td style={tdStyle}>{a.isPinned ? 'Ya' : '-'}</td>
                <td style={tdStyle}>{new Date(a.publishedAt).toLocaleString('id-ID')}</td>
                <td style={tdStyle}>
                  <button
                    style={smallButtonStyle}
                    disabled={deletingId === a.id}
                    onClick={() => handleDelete(a.id)}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 style={h3Style}>Buat Pengumuman Baru</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <div>
          <label style={labelStyle}>Judul</label>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Isi</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Target</label>
          <select
            style={selectStyle}
            value={target}
            onChange={(e) => setTarget(e.target.value as 'all' | 'kelurahan')}
          >
            <option value="all">Semua warga</option>
            <option value="kelurahan">Kelurahan tertentu</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Kategori</label>
          <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tanpa kategori</option>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Lampiran PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {target === 'kelurahan' ? (
          <div>
            <label style={labelStyle}>Nama Kelurahan</label>
            <input style={inputStyle} value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} />
          </div>
        ) : null}
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
          Sematkan di atas
        </label>
        <button style={smallButtonStyle} disabled={submitting} onClick={handleCreate}>
          {submitting ? 'Menyimpan…' : 'Buat Pengumuman'}
        </button>
      </div>
      {formError ? <p style={{ color: '#DC2626', fontSize: 13 }}>{formError}</p> : null}
    </section>
  );
}

function LeaderboardSection({
  leaderboard,
  onRefreshed,
}: {
  leaderboard: KelurahanLeaderboardEntry[];
  onRefreshed: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshLeaderboard(supabase);
      onRefreshed();
    } catch (e) {
      console.error('refreshLeaderboard error', e);
      setRefreshError('Gagal menyegarkan peringkat. Coba lagi.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Peringkat Kelurahan</h2>
      <button style={{ ...smallButtonStyle, marginBottom: 12 }} disabled={refreshing} onClick={handleRefresh}>
        {refreshing ? 'Menyegarkan…' : 'Segarkan Sekarang'}
      </button>
      {refreshError ? <p style={{ color: '#DC2626', fontSize: 13 }}>{refreshError}</p> : null}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Kelurahan</th>
            <th style={thStyle}>Kecamatan</th>
            <th style={thStyle}>Warga</th>
            <th style={thStyle}>Aduan Selesai</th>
            <th style={thStyle}>Total Poin</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={6}>
                Belum ada data peringkat.
              </td>
            </tr>
          ) : (
            leaderboard.map((entry, i) => (
              <tr key={entry.kelurahan}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{entry.kelurahan}</td>
                <td style={tdStyle}>{entry.kecamatan ?? '-'}</td>
                <td style={tdStyle}>{entry.citizenCount}</td>
                <td style={tdStyle}>
                  {entry.resolvedCount}/{entry.reportCount}
                </td>
                <td style={tdStyle}>{entry.totalPoints}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
const h3Style: CSSProperties = { fontSize: 15, marginTop: 20, marginBottom: 8 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #E2E8F0',
  padding: '8px 6px',
  color: '#475569',
};
const tdStyle: CSSProperties = { borderBottom: '1px solid #E2E8F0', padding: '8px 6px' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 };
const inputStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 14,
  boxSizing: 'border-box',
  width: '100%',
};
const selectStyle: CSSProperties = {
  minHeight: 32,
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  padding: '2px 6px',
  fontSize: 13,
};
const smallButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#0F4C5C',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
