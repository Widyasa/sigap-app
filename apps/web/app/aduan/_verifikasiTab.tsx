'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  listComplaintsForVerifier,
  updateComplaintClassification,
  type VerifierComplaint,
} from '@repo/supabase';
import {
  CATEGORY_LIST,
  COMPLAINT_STATUS_LABELS,
  DINAS_LIST,
  URGENCY_LABELS,
  URGENCY_VALUES,
  categoryLabel,
  colors,
  spacing,
  statusColor,
  typography,
  type Urgency,
  type ComplaintStatus,
} from '@repo/shared';
import type { StaffProfile } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { AsyncSection, EmptyState, Modal, dangerButtonStyle, secondaryButtonStyle } from '../_lib/ui';

const THEME = colors.light;

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
      {/* Hitungan hanya ditampilkan setelah data benar-benar ada. Dulu baris
          ini dirender di atas pemuat, jadi lukisan pertama SELALU berbunyi
          "0 aduan menunggu tindakan" — dan tetap 0 setelah gagal memuat. */}
      {!loading && !error ? (
        <p style={{ fontSize: typography.caption.fontSize, color: THEME.textSecondary, margin: '0 0 12px' }}>
          {complaints.length} aduan menunggu tindakan.
        </p>
      ) : null}

      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : complaints}
        onRetry={load}
        loadingMessage="Memuat antrean verifikasi…"
        empty={
          <EmptyState
            icon="✅"
            title="Tidak ada aduan yang perlu diverifikasi"
            message="Aduan baru dari warga akan muncul di sini setelah diklasifikasi otomatis."
          />
        }
      >
        {(items) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing(4) }}>
            {items.map((c) => (
              <ComplaintCard key={c.id} complaint={c} onChanged={load} />
            ))}
          </div>
        )}
      </AsyncSection>
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

  // Sinkronkan ulang saat barisnya berubah di server. Kartu ini di-`key` per
  // `complaint.id`, jadi React memakai ulang komponennya setelah
  // `onChanged()` memuat ulang daftar — tanpa efek ini, koreksi yang
  // dilakukan verifikator lain pada aduan yang sama tidak pernah terlihat.
  useEffect(() => {
    setEdit(editStateFor(complaint));
  }, [complaint]);
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
        currentSlaDueAt: complaint.slaDueAt,
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
          {COMPLAINT_STATUS_LABELS[complaint.status]}
        </span>
      </div>

      <p style={{ fontSize: 14, margin: '10px 0' }}>{complaint.description}</p>
      {/* `accent` hanya 2,49:1 di atas putih. `accentText` adalah varian
          teal yang cukup gelap (5,47:1) dengan rona yang sama. */}
      {complaint.aiSummary ? (
        <p style={{ fontSize: typography.caption.fontSize, color: THEME.accentText, margin: '0 0 10px' }}>
          Ringkasan AI: {complaint.aiSummary}
        </p>
      ) : null}
      {complaint.imageUrls.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {complaint.imageUrls.map((url, i) => (
            // Dulu ketiga foto bukti diumumkan identik sebagai "Foto aduan",
            // sehingga pengguna pembaca layar tidak bisa membedakannya
            // padahal menilai foto itulah seluruh tugas di layar ini.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Foto aduan ${i + 1} dari ${complaint.imageUrls.length}: ${complaint.title ?? 'tanpa judul'}`}
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6 }}
            />
          ))}
        </div>
      ) : null}

      <div style={gridFormStyle}>
        <div>
          <label htmlFor={`judul-${complaint.id}`} style={labelStyle}>Judul</label>
          <input
            id={`judul-${complaint.id}`}
            style={inputStyle}
            value={edit.title}
            onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor={`kategori-${complaint.id}`} style={labelStyle}>Kategori</label>
          <select
            id={`kategori-${complaint.id}`}
            style={inputStyle}
            value={edit.category}
            onChange={(e) => setEdit((s) => ({ ...s, category: e.target.value }))}
          >
            {/* Dulu id mentah (`jalan_rusak`, `pkl_liar`) tampil apa adanya. */}
            {CATEGORY_LIST.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`dinas-${complaint.id}`} style={labelStyle}>Dinas</label>
          <select
            id={`dinas-${complaint.id}`}
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
          <label htmlFor={`urgensi-${complaint.id}`} style={labelStyle}>Urgensi</label>
          <select
            id={`urgensi-${complaint.id}`}
            style={inputStyle}
            value={edit.urgency}
            onChange={(e) => setEdit((s) => ({ ...s, urgency: e.target.value as Urgency }))}
          >
            {/* Aplikasi warga menampilkan "Darurat/Penting/Normal";
                dashboard dulu menampilkan "P0/P1/P2". */}
            {URGENCY_VALUES.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABELS[u]} ({u})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`status-${complaint.id}`} style={labelStyle}>Status (koreksi)</label>
          <select
            id={`status-${complaint.id}`}
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
            {/* Teks putih di atas `accent` = 2,49:1. Teks `textPrimary` di
                atas warna teal yang sama = 7,17:1 dan tetap membedakan tombol
                ini dari tombol netral di sebelahnya. */}
            <button
              type="button"
              style={{ ...buttonStyle, background: THEME.accent, color: THEME.textPrimary }}
              disabled={saving}
              onClick={handleVerify}
            >
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

/** Modal alasan penolakan memakai primitif `Modal` bersama (role="dialog",
 * jebakan fokus, Escape, pengembalian fokus). */
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
    <Modal title="Alasan Penolakan" onClose={onCancel}>
      <p style={{ fontSize: typography.caption.fontSize, color: THEME.textSecondary, marginTop: 0 }}>
        Jelaskan alasan penolakan aduan ini. Alasan wajib diisi dan ditampilkan ke pelapor.
      </p>
      <label htmlFor="alasan-tolak-aduan" style={{ display: 'block', fontSize: typography.caption.fontSize, marginBottom: 4 }}>
        Alasan penolakan
      </label>
      <textarea
        id="alasan-tolak-aduan"
        style={textareaStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
          Batal
        </button>
        <button
          type="button"
          style={{ ...dangerButtonStyle, opacity: trimmed ? 1 : 0.5 }}
          disabled={!trimmed}
          onClick={() => onConfirm(trimmed)}
        >
          Konfirmasi
        </button>
      </div>
    </Modal>
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
