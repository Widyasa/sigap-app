'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  listComplaintsForVerifier,
  updateComplaintClassification,
  type VerifierComplaint,
} from '@repo/supabase';
import {
  CATEGORY_LIST,
  DINAS_LIST,
  URGENCY_VALUES,
  colors,
  spacing,
  statusColor,
  type Urgency,
  type ComplaintStatus,
} from '@repo/shared';
import type { StaffProfile } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';

const THEME = colors.light;

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi AI',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Ditindaklanjuti',
  resolved: 'Selesai',
  rejected: 'Ditolak',
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
export function VerifikasiTab({ user }: { user: StaffProfile }) {
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
    load();
  }, [load]);

  return (
    <div>
      <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '0 0 12px' }}>
        {complaints.length} aduan menunggu tindakan.
      </p>
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: THEME.textSecondary }}>Memuat data…</p>
      ) : complaints.length === 0 ? (
        <p style={{ color: THEME.textSecondary }}>Tidak ada aduan yang perlu diverifikasi saat ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing(4) }}>
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
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  // Sumber alasan penolakan: 'reject' (tombol Tolak) atau 'classification'
  // (Koreksi Klasifikasi dengan status 'rejected' dipilih di dropdown).
  const [rejectSource, setRejectSource] = useState<'reject' | 'classification'>('reject');
  const color = statusColor(complaint.status, 'light');

  const submitReject = async (reason: string) => {
    setRejectModalOpen(false);
    setSaving(true);
    setActionError(null);
    try {
      if (rejectSource === 'classification') {
        await updateComplaintClassification(supabase, complaint.id, {
          currentStatus: complaint.status,
          status: edit.status,
          title: edit.title || null,
          category: edit.category,
          assignedDinas: edit.assignedDinas,
          urgency: edit.urgency,
          rejectionReason: reason,
        });
      } else {
        await updateComplaintClassification(supabase, complaint.id, {
          currentStatus: complaint.status,
          status: 'rejected',
          rejectionReason: reason,
        });
      }
      onChanged();
    } catch (e) {
      console.error('reject complaint error', e);
      setActionError(
        rejectSource === 'classification'
          ? 'Gagal menyimpan koreksi klasifikasi. Coba lagi.'
          : 'Gagal menolak aduan. Coba lagi.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClassification = async () => {
    if (edit.status === 'rejected') {
      setRejectSource('classification');
      setRejectModalOpen(true);
      return;
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

  const handleReject = () => {
    setRejectSource('reject');
    setRejectModalOpen(true);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{complaint.title ?? '(Tanpa judul)'}</h2>
          <p style={{ fontSize: 13, color: THEME.textSecondary, margin: 0 }}>
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
        <p style={{ fontSize: 13, color: THEME.accent, margin: '0 0 10px' }}>
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

      {actionError ? <p style={{ color: THEME.danger, fontSize: 13, marginTop: 8 }}>{actionError}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button style={buttonStyle} disabled={saving} onClick={handleSaveClassification}>
          {saving ? 'Menyimpan…' : 'Koreksi Klasifikasi'}
        </button>
        {complaint.status === 'pending' ? (
          <>
            <button style={{ ...buttonStyle, background: THEME.accent }} disabled={saving} onClick={handleVerify}>
              Verifikasi
            </button>
            <button style={{ ...buttonStyle, background: THEME.danger }} disabled={saving} onClick={handleReject}>
              Tolak
            </button>
          </>
        ) : null}
      </div>

      {rejectModalOpen ? (
        <RejectReasonModal
          onCancel={() => setRejectModalOpen(false)}
          onConfirm={submitReject}
        />
      ) : null}
    </div>
  );
}

/**
 * Modal alasan penolakan — pengganti dialog konfirmasi bawaan browser
 * (tidak bisa distyle, tidak konsisten dengan sisa aplikasi). Dipakai ulang
 * oleh tombol "Tolak" dan "Koreksi Klasifikasi" (saat status = 'rejected').
 */
function RejectReasonModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <div style={modalOverlayStyle} onClick={onCancel}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, margin: '0 0 8px', color: THEME.textPrimary }}>Alasan Penolakan</h3>
        <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '0 0 12px' }}>
          Jelaskan alasan penolakan aduan ini. Alasan wajib diisi.
        </p>
        <textarea
          style={textareaStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan penolakan (wajib diisi)…"
          rows={4}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={secondaryButtonStyle} onClick={onCancel}>
            Batal
          </button>
          <button
            style={{ ...buttonStyle, background: THEME.danger, opacity: trimmed ? 1 : 0.5 }}
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 10,
  padding: 16,
  background: THEME.surface,
};

const gridFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: THEME.textSecondary, marginBottom: 4 };

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

const secondaryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 6,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface,
  color: THEME.textPrimary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalCardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 10,
  padding: 20,
  width: '100%',
  maxWidth: 420,
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'inherit',
};
