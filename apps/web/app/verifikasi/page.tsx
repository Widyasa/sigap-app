'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listComplaintsForVerifier,
  updateComplaintClassification,
  type VerifierComplaint,
} from '@repo/supabase';
import { CATEGORY_LIST, DINAS_LIST, URGENCY_VALUES, type Urgency, type ComplaintStatus } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';

const VERIFIER_ROLES = ['verifier', 'admin'];

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

interface EditState {
  title: string;
  category: string;
  assignedDinas: string;
  urgency: Urgency;
  status: 'pending' | 'rejected';
}

function editStateFor(c: VerifierComplaint): EditState {
  return {
    title: c.title ?? '',
    category: c.category ?? CATEGORY_LIST[0] ?? '',
    assignedDinas: c.assignedDinas ?? DINAS_LIST[0]?.id ?? '',
    urgency: (c.urgency ?? 'P2') as Urgency,
    // Default ke 'pending': target koreksi paling umum. Verifier bisa
    // memilih 'rejected' langsung dari dropdown ini jika perlu.
    status: 'pending',
  };
}

/**
 * Antrean aduan verifier (issue #14, kriteria "Verifier sees aduan queue and
 * can correct AI classification"). Hanya aduan `pending_classification`
 * (baru, belum diklasifikasi AI atau AI gagal) dan `pending` (sudah
 * diklasifikasi, menunggu manusia) yang bisa diedit — status lain sudah
 * lewat tahap verifikasi (lihat `isValidClassificationTransition`).
 */
export default function VerifikasiPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && VERIFIER_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [complaints, setComplaints] = useState<VerifierComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listComplaintsForVerifier(supabase);
      setComplaints(list);
    } catch (e) {
      console.error('listComplaintsForVerifier error', e);
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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Verifikasi Aduan</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user?.fullName ?? user?.role}. {complaints.length} aduan menunggu tindakan.
      </p>

      {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : complaints.length === 0 ? (
        <p>Tidak ada aduan yang perlu diverifikasi saat ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complaints.map((c) => (
            <ComplaintCard key={c.id} complaint={c} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({
  complaint,
  onChanged,
}: {
  complaint: VerifierComplaint;
  onChanged: () => void;
}) {
  const [edit, setEdit] = useState<EditState>(() => editStateFor(complaint));
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const color = STATUS_COLORS[complaint.status];

  const handleSaveClassification = async () => {
    let rejectionReason: string | undefined;
    if (edit.status === 'rejected') {
      const reason = window.prompt('Alasan penolakan (wajib diisi):');
      if (!reason) return;
      rejectionReason = reason;
    }
    setSaving(true);
    setActionError(null);
    try {
      await updateComplaintClassification(supabase, complaint.id, {
        currentStatus: complaint.status,
        status: edit.status,
        title: edit.title || null,
        category: edit.category,
        assignedDinas: edit.assignedDinas,
        urgency: edit.urgency,
        rejectionReason,
      });
      onChanged();
    } catch (e) {
      console.error('updateComplaintClassification error', e);
      setActionError('Gagal menyimpan koreksi klasifikasi. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await updateComplaintClassification(supabase, complaint.id, {
        currentStatus: complaint.status,
        status: 'verified',
      });
      onChanged();
    } catch (e) {
      console.error('verify complaint error', e);
      setActionError('Gagal memverifikasi aduan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Alasan penolakan (wajib diisi):');
    if (!reason) return;
    setSaving(true);
    setActionError(null);
    try {
      await updateComplaintClassification(supabase, complaint.id, {
        currentStatus: complaint.status,
        status: 'rejected',
        rejectionReason: reason,
      });
      onChanged();
    } catch (e) {
      console.error('reject complaint error', e);
      setActionError('Gagal menolak aduan. Coba lagi.');
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
            {complaint.kelurahan ?? '-'}, {complaint.kecamatan ?? '-'} · Diajukan{' '}
            {new Date(complaint.createdAt).toLocaleString('id-ID')} · {complaint.upvoteCount} dukungan
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
      {complaint.aiSummary ? (
        <p style={{ fontSize: 13, color: '#7C3AED', margin: '0 0 10px' }}>
          Ringkasan AI: {complaint.aiSummary}
        </p>
      ) : null}
      {complaint.imageUrls.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {complaint.imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="Foto aduan" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6 }} />
          ))}
        </div>
      ) : null}

      <div style={gridFormStyle}>
        <div>
          <label style={labelStyle}>Judul</label>
          <input
            style={inputStyle}
            value={edit.title}
            onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))}
          />
        </div>
        <div>
          <label style={labelStyle}>Kategori</label>
          <select
            style={inputStyle}
            value={edit.category}
            onChange={(e) => setEdit((s) => ({ ...s, category: e.target.value }))}
          >
            {CATEGORY_LIST.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Dinas</label>
          <select
            style={inputStyle}
            value={edit.assignedDinas}
            onChange={(e) => setEdit((s) => ({ ...s, assignedDinas: e.target.value }))}
          >
            {DINAS_LIST.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Urgensi</label>
          <select
            style={inputStyle}
            value={edit.urgency}
            onChange={(e) => setEdit((s) => ({ ...s, urgency: e.target.value as Urgency }))}
          >
            {URGENCY_VALUES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status (koreksi)</label>
          <select
            style={inputStyle}
            value={edit.status}
            onChange={(e) => setEdit((s) => ({ ...s, status: e.target.value as EditState['status'] }))}
          >
            <option value="pending">Menunggu Verifikasi</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
      </div>

      {actionError ? <p style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>{actionError}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button style={buttonStyle} disabled={saving} onClick={handleSaveClassification}>
          {saving ? 'Menyimpan…' : 'Koreksi Klasifikasi'}
        </button>
        {complaint.status === 'pending' ? (
          <>
            <button style={{ ...buttonStyle, background: '#16A34A' }} disabled={saving} onClick={handleVerify}>
              Verifikasi
            </button>
            <button style={{ ...buttonStyle, background: '#DC2626' }} disabled={saving} onClick={handleReject}>
              Tolak
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
  background: '#FFFFFF',
};

const gridFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 };

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
