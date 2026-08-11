'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listComplaintsForDinas,
  listActiveComplaintsAllDinas,
  updateComplaintStatus,
  type DinasComplaint,
} from '@repo/supabase';
import type { ComplaintStatus } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';

const DINAS_ROLES = ['dinas_staff', 'dinas_head', 'admin'];

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi AI',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Ditindaklanjuti',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

const STATUS_COLORS: Record<ComplaintStatus, { fg: string; bg: string }> = {
  pending_classification: { fg: '#CA8A04', bg: '#FEFCE8' },
  pending: { fg: '#2563EB', bg: '#EFF6FF' },
  verified: { fg: '#16A34A', bg: '#F0FDF4' },
  in_progress: { fg: '#7C3AED', bg: '#F5F3FF' },
  resolved: { fg: '#16A34A', bg: '#F0FDF4' },
  rejected: { fg: '#DC2626', bg: '#FEF2F2' },
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
export default function DinasPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && DINAS_ROLES.includes(user.role);
  const isAdminWithoutDinas = user?.role === 'admin' && !user.dinasId;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [complaints, setComplaints] = useState<DinasComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list =
        user?.role === 'admin' && !user.dinasId
          ? await listActiveComplaintsAllDinas(supabase)
          : await listComplaintsForDinas(supabase, user!.dinasId!);
      setComplaints(list);
    } catch (e) {
      console.error('listComplaintsForDinas error', e);
      setError('Gagal memuat data. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.dinasId]);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  if (user?.role !== 'admin' && !user?.dinasId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#DC2626' }}>
          Akun Anda belum ditugaskan ke dinas mana pun. Hubungi admin untuk penugasan dinas.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 960, padding: 24, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Aduan Dinas</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user?.fullName ?? user?.role}.{' '}
        {isAdminWithoutDinas
          ? 'Menampilkan seluruh aduan aktif lintas dinas (mode admin).'
          : `Menampilkan aduan dinas ${user?.dinasId}.`}
      </p>

      {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : complaints.length === 0 ? (
        <p>Tidak ada aduan aktif saat ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complaints.map((c) => (
            <ComplaintCard key={c.id} complaint={c} actorId={user!.id} onChanged={load} />
          ))}
        </div>
      )}
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
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const color = STATUS_COLORS[complaint.status];

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
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
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

      {actionError ? <p style={{ color: '#DC2626', fontSize: 13 }}>{actionError}</p> : null}

      {formOpenFor ? (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, marginTop: 8 }}>
          <label style={labelStyle}>Catatan progres</label>
          <textarea
            style={{ ...inputStyle, minHeight: 60 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label style={labelStyle}>URL foto (opsional)</label>
          <input
            style={inputStyle}
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={buttonStyle} disabled={saving} onClick={handleSubmit}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              style={{ ...buttonStyle, background: 'transparent', color: '#0F4C5C', border: '1px solid #0F4C5C' }}
              disabled={saving}
              onClick={() => setFormOpenFor(null)}
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
          {complaint.status === 'in_progress' ? (
            <button style={{ ...buttonStyle, background: '#16A34A' }} onClick={() => setFormOpenFor('resolved')}>
              Selesai
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
  background: '#FFFFFF',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 8 };

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 36,
  border: '1px solid #E2E8F0',
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
  background: '#0F4C5C',
  color: '#FFFFFF',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
