'use client';

import { useCallback, useEffect, useState, type CSSProperties, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  listAnnouncementsForAdmin,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  refreshLeaderboard,
  listLeaderboard,
  type Announcement,
  type KelurahanLeaderboardEntry,
} from '@repo/supabase';
import { createAnnouncementSchema, ANNOUNCEMENT_CATEGORIES, colors } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import { ConfirmModal } from '../_lib/ConfirmModal';

const THEME = colors.light;

/** Sepadan dengan batas unggahan bucket lampiran pengumuman. */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

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
    <DashboardShell title="Info & Komunitas" subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}.`}>
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <>
          <AnnouncementsSection announcements={announcements} onChanged={load} />
          <LeaderboardSection leaderboard={leaderboard} onRefreshed={load} />
        </>
      )}
    </DashboardShell>
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
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTarget, setEditTarget] = useState<'all' | 'kelurahan'>('all');
  const [editKelurahan, setEditKelurahan] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsPinned, setEditIsPinned] = useState(false);
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [editRemoveAttachment, setEditRemoveAttachment] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditStart = (a: Announcement) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditBody(a.body);
    setEditTarget(a.kelurahan ? 'kelurahan' : 'all');
    setEditKelurahan(a.kelurahan ?? '');
    setEditCategory(a.category ?? '');
    setEditIsPinned(a.isPinned);
    setEditAttachmentFile(null);
    setEditRemoveAttachment(false);
    setEditError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditSave = async (id: string, a: Announcement) => {
    setEditError(null);
    // Penjagaan HARUS di atas `setEditSubmitting(true)`. Dulu ia di bawah
    // dan `return` tanpa mereset flag, sehingga tombol Simpan terkunci
    // selamanya pada "Menyimpan…" dan satu-satunya jalan keluar adalah
    // memuat ulang halaman — yang membuang seluruh suntingan.
    if (!user?.id) {
      setEditError('Sesi Anda berakhir. Silakan masuk kembali.');
      return;
    }
    setEditSubmitting(true);

    // B: `attachmentUrl` bertipe `string | null` di `Announcement`, sedangkan
    // `createAnnouncementSchema.attachmentUrl` adalah `z.string().optional()`
    // yang MENOLAK null. Akibatnya menyunting pengumuman apa pun yang tidak
    // punya lampiran — kasus paling umum — selalu gagal dengan "Data
    // pengumuman tidak valid.".
    let attachmentUrl = editRemoveAttachment ? undefined : a.attachmentUrl ?? undefined;
    let attachmentName = editRemoveAttachment ? undefined : a.attachmentName ?? undefined;

    if (editAttachmentFile) {
      if (editAttachmentFile.type !== 'application/pdf') {
        setEditError('Lampiran harus berkas PDF.');
        setEditSubmitting(false);
        return;
      }
      if (editAttachmentFile.size > MAX_ATTACHMENT_BYTES) {
        setEditError('Ukuran lampiran maksimal 5 MB.');
        setEditSubmitting(false);
        return;
      }
      try {
        const path = `${user.id}/${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(path, editAttachmentFile, { contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        attachmentUrl = supabase.storage.from('announcement-attachments').getPublicUrl(path).data.publicUrl;
        attachmentName = editAttachmentFile.name;
      } catch (e) {
        console.error('upload attachment error', e);
        setEditError('Gagal mengunggah lampiran PDF. Coba lagi.');
        setEditSubmitting(false);
        return;
      }
    }

    const parsed = createAnnouncementSchema.safeParse({
      title: editTitle,
      body: editBody,
      kelurahan: editTarget === 'kelurahan' ? editKelurahan.trim() : undefined,
      category: editCategory || undefined,
      attachmentUrl,
      attachmentName,
      isPinned: editIsPinned,
    });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? 'Data pengumuman tidak valid.');
      setEditSubmitting(false);
      return;
    }

    try {
      // `dinasId`, `imageUrl`, dan `expiresAt` sengaja diteruskan apa
      // adanya: `updateAnnouncement` menulis `?? null` untuk setiap field
      // yang hilang, sehingga menyunting judul saja DULU menghapus dinas,
      // gambar, dan tanggal kedaluwarsa pengumuman itu.
      await updateAnnouncement(supabase, id, {
        ...parsed.data,
        dinasId: a.dinasId ?? undefined,
        imageUrl: a.imageUrl ?? undefined,
        expiresAt: a.expiresAt ?? undefined,
      });
      handleEditCancel();
      onChanged();
    } catch (e) {
      console.error('updateAnnouncement error', e);
      setEditError('Gagal memperbarui pengumuman. Coba lagi.');
    } finally {
      setEditSubmitting(false);
    }
  };
  const { user } = useAuth();

  const handleCreate = async () => {
    setFormError(null);
    if (!user?.id) {
      setFormError('Sesi Anda berakhir. Silakan masuk kembali.');
      return;
    }

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (attachmentFile) {
      // `accept="application/pdf"` hanya menyaring dialog berkas; seret-lepas
      // atau "All Files" melewatinya, dan berkas apa pun akan tersimpan serta
      // disajikan sebagai PDF di bucket publik.
      if (attachmentFile.type !== 'application/pdf') {
        setFormError('Lampiran harus berkas PDF.');
        return;
      }
      if (attachmentFile.size > MAX_ATTACHMENT_BYTES) {
        setFormError('Ukuran lampiran maksimal 5 MB.');
        return;
      }
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
            <th style={thStyle}>Aksi</th>
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
              <Fragment key={a.id}>
                <tr>
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
                  <td style={{ ...tdStyle, display: 'flex', gap: 4 }}>
                    <button style={smallButtonStyle} onClick={() => handleEditStart(a)}>
                      Ubah
                    </button>
                    <button
                      style={smallButtonStyle}
                      disabled={deletingId === a.id}
                      onClick={() => setConfirmingDeleteId(a.id)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
                {editingId === a.id && (
                  <tr>
                    <td style={tdStyle} colSpan={7}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
                        <input style={inputStyle} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        <textarea
                          style={{ ...inputStyle, minHeight: 80 }}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                        />
                        <select
                          style={selectStyle}
                          value={editTarget}
                          onChange={(e) => setEditTarget(e.target.value as 'all' | 'kelurahan')}
                        >
                          <option value="all">Semua warga</option>
                          <option value="kelurahan">Kelurahan tertentu</option>
                        </select>
                        {editTarget === 'kelurahan' && (
                          <input style={inputStyle} value={editKelurahan} onChange={(e) => setEditKelurahan(e.target.value)} />
                        )}
                        <select style={selectStyle} value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                          <option value="">Tanpa kategori</option>
                          {ANNOUNCEMENT_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <div>
                          <label style={labelStyle}>Lampiran saat ini: {a.attachmentName ?? '-'}</label>
                          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={editRemoveAttachment} onChange={(e) => setEditRemoveAttachment(e.target.checked)} />
                            Hapus lampiran
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setEditAttachmentFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={editIsPinned} onChange={(e) => setEditIsPinned(e.target.checked)} />
                          Sematkan di atas
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={smallButtonStyle} disabled={editSubmitting} onClick={() => handleEditSave(a.id, a)}>
                            {editSubmitting ? 'Menyimpan…' : 'Simpan'}
                          </button>
                          <button style={smallButtonStyle} onClick={handleEditCancel}>Batal</button>
                        </div>
                        {editError && <p style={{ color: THEME.danger, fontSize: 13 }}>{editError}</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
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
      {formError ? <p style={{ color: THEME.danger, fontSize: 13 }}>{formError}</p> : null}
      {confirmingDeleteId ? (
        <ConfirmModal
          title="Hapus Pengumuman"
          message="Pengumuman ini akan dihapus permanen dan tidak dapat dipulihkan."
          danger
          onCancel={() => setConfirmingDeleteId(null)}
          onConfirm={() => {
            const id = confirmingDeleteId;
            setConfirmingDeleteId(null);
            if (id) handleDelete(id);
          }}
        />
      ) : null}
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
      {refreshError ? <p style={{ color: THEME.danger, fontSize: 13 }}>{refreshError}</p> : null}

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
  borderBottom: `1px solid ${THEME.border}`,
  padding: '8px 6px',
  color: THEME.textSecondary,
};
const tdStyle: CSSProperties = { borderBottom: `1px solid ${THEME.border}`, padding: '8px 6px' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: THEME.textSecondary, marginBottom: 4 };
const inputStyle: CSSProperties = {
  minHeight: 36,
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 14,
  boxSizing: 'border-box',
  width: '100%',
};
const selectStyle: CSSProperties = {
  minHeight: 32,
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '2px 6px',
  fontSize: 13,
};
const smallButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  background: THEME.primary,
  color: THEME.surface,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
