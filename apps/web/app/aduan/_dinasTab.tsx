'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  listComplaintsForDinas,
  listActiveComplaintsAllDinas,
  updateComplaintStatus,
  uploadProgressPhoto,
  type DinasComplaint,
} from '@repo/supabase';
import { DINAS_LIST, colors, spacing, statusColor, type ComplaintStatus } from '@repo/shared';
import type { StaffProfile } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { AsyncSection, EmptyState } from '../_lib/ui';

const THEME = colors.light;

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi AI',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Ditindaklanjuti',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

/**
 * Antrean aduan dinas (issue #14, kriteria "Dinas staff sees only aduan
 * assigned to their dinas"). Dinas staff/head SELALU melihat aduan dinasnya
 * sendiri lewat `listComplaintsForDinas(dinasId)` — RLS `complaints_dinas_
 * update` menegakkan batas TULIS yang sama di server.
 *
 * Admin tidak punya `dinasId` (bukan anggota satu dinas tertentu), jadi
 * untuk admin halaman ini menampilkan gabungan seluruh aduan aktif lintas
 * dinas (`listActiveComplaintsAllDinas`) — read-model saja, bukan celah RLS
 * baru: penulisan status tetap lewat `complaints_verifier_update` yang sudah
 * mengizinkan admin menulis baris `complaints` mana pun.
 */
export function DinasTab({ user }: { user: StaffProfile }) {
  const isAdminWithoutDinas = user.role === 'admin' && !user.dinasId;

  const [complaints, setComplaints] = useState<DinasComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Peran dinas tanpa penugasan tidak boleh memanggil query sama sekali:
  // `listComplaintsForDinas(supabase, user.dinasId!)` meneruskan null lewat
  // non-null assertion, sedangkan penjagaannya baru berjalan setelah efek.
  const unassigned = user.role !== 'admin' && !user.dinasId;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list =
        user.role === 'admin' && !user.dinasId
          ? await listActiveComplaintsAllDinas(supabase)
          : await listComplaintsForDinas(supabase, user.dinasId!);
      setComplaints(list);
    } catch (e) {
      console.error('listComplaintsForDinas error', e);
      setError('Gagal memuat data. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user.role, user.dinasId]);

  useEffect(() => {
    if (unassigned) return;
    load();
  }, [load, unassigned]);

  if (unassigned) {
    return (
      <p style={{ color: THEME.danger }}>
        Akun Anda belum ditugaskan ke dinas mana pun. Hubungi admin untuk penugasan dinas.
      </p>
    );
  }

  const dinasName = DINAS_LIST.find((d) => d.id === user.dinasId)?.name ?? user.dinasId;

  return (
    <div>
      <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '0 0 12px' }}>
        {isAdminWithoutDinas ? 'Menampilkan seluruh aduan aktif lintas dinas (mode admin).' : `Menampilkan aduan dinas ${dinasName}.`}
      </p>
      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : complaints}
        onRetry={load}
        loadingMessage="Memuat antrean dinas…"
        empty={
          <EmptyState
            icon="🛠️"
            title="Tidak ada aduan aktif"
            message="Aduan yang sudah lolos verifikasi dan ditujukan ke dinas ini akan muncul di sini."
          />
        }
      >
        {(items) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing(4) }}>
            {items.map((c) => (
              <ComplaintCard key={c.id} complaint={c} actorId={user.id} onChanged={load} />
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}

function ComplaintCard({
  complaint,
  actorId,
  onChanged,
}: {
  complaint: DinasComplaint;
  actorId: string;
  onChanged: () => void;
}) {
  const [formOpenFor, setFormOpenFor] = useState<'in_progress' | 'resolved' | null>(null);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const color = statusColor(complaint.status, 'light');

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadProgressPhoto(supabase, complaint.id, file, file.type || 'image/jpeg');
      setPhotoUrl(url);
    } catch (err) {
      console.error('uploadProgressPhoto error', err);
      setUploadError('Gagal mengunggah foto. Coba lagi.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formOpenFor) return;
    setSaving(true);
    setActionError(null);
    try {
      await updateComplaintStatus(supabase, complaint.id, {
        status: formOpenFor,
        actorId,
        note: note || undefined,
        photoUrls: photoUrl ? [photoUrl] : undefined,
      });
      setFormOpenFor(null);
      setNote('');
      setPhotoUrl('');
      onChanged();
    } catch (e) {
      console.error('updateComplaintStatus error', e);
      setActionError('Gagal menyimpan status. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{complaint.title ?? '(Tanpa judul)'}</h2>
          <p style={{ fontSize: 13, color: THEME.textSecondary, margin: 0 }}>
            {complaint.category ?? '-'} · {complaint.urgency ?? '-'} · {complaint.kelurahan ?? '-'},{' '}
            {complaint.kecamatan ?? '-'} · Diajukan {new Date(complaint.createdAt).toLocaleString('id-ID')} ·{' '}
            {complaint.upvoteCount} dukungan
          </p>
        </div>
        <span
          style={{
            display: 'inline-block',
            height: 'fit-content',
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: color.fg,
            background: color.bg,
          }}
        >
          {STATUS_LABELS[complaint.status]}
        </span>
      </div>

      <p style={{ fontSize: 14, margin: '10px 0' }}>{complaint.description}</p>

      {actionError ? <p role="alert" style={{ color: THEME.danger, fontSize: 13 }}>{actionError}</p> : null}

      {formOpenFor ? (
        <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
          <label htmlFor={`catatan-${complaint.id}`} style={labelStyle}>
            Catatan progres
          </label>
          <textarea
            id={`catatan-${complaint.id}`}
            style={{ ...inputStyle, minHeight: 60 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label htmlFor={`foto-${complaint.id}`} style={labelStyle}>
            Foto progres (opsional)
          </label>
          <input
            id={`foto-${complaint.id}`}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={uploading}
          />
          {uploading ? (
            <p role="status" style={{ fontSize: 14, color: THEME.textSecondary, margin: '4px 0 0' }}>
              Mengunggah…
            </p>
          ) : null}
          {uploadError ? (
            <p role="alert" style={{ fontSize: 14, color: THEME.danger, margin: '4px 0 0' }}>
              {uploadError}
            </p>
          ) : null}
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Foto progres"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, marginTop: 8 }}
            />
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={buttonStyle} disabled={saving || uploading} onClick={handleSubmit}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              style={{ ...buttonStyle, background: 'transparent', color: THEME.primary, border: `1px solid ${THEME.primary}` }}
              disabled={saving}
              onClick={() => {
                setFormOpenFor(null);
                setNote('');
                setPhotoUrl('');
                setUploadError(null);
              }}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {complaint.status === 'verified' ? (
            <button style={buttonStyle} onClick={() => setFormOpenFor('in_progress')}>
              Tindak Lanjut
            </button>
          ) : null}
          {/* Sama seperti tombol "Verifikasi": putih di atas `accent`
              hanya 2,49:1, jadi teksnya memakai `textPrimary` (7,17:1). */}
          {complaint.status === 'in_progress' ? (
            <button
              type="button"
              style={{ ...buttonStyle, background: THEME.accent, color: THEME.textPrimary }}
              onClick={() => setFormOpenFor('resolved')}
            >
              Selesai
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 10,
  padding: 16,
  background: THEME.surface,
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: THEME.textSecondary, marginBottom: 4, marginTop: 8 };

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 36,
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 13,
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  background: THEME.primary,
  color: THEME.surface,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
