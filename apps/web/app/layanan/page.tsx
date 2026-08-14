'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listServiceRequestsForReview,
  getServiceRequestSignedUrl,
  updateServiceRequestStatus,
  generateServicePdf,
  type ServiceRequestSummary,
} from '@repo/supabase';
import {
  SERVICE_CATALOG,
  SERVICE_STATUSES,
  colors,
  serviceStatusColor,
  type ServiceStatus,
} from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';

const THEME = colors.light;
const STAFF_ROLES = ['verifier', 'dinas_staff', 'dinas_head', 'admin'];

const STATUS_LABELS: Record<ServiceStatus, string> = {
  submitted: 'Diajukan',
  verifying: 'Diverifikasi',
  signing: 'Ditandatangani',
  ready: 'Siap Diambil',
  rejected: 'Ditolak',
  collected: 'Sudah Diambil',
};

function serviceTypeName(serviceType: string): string {
  return SERVICE_CATALOG.find((s) => s.id === serviceType)?.name ?? serviceType;
}

export default function LayananAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user, getAccessToken } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && STAFF_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listServiceRequestsForReview(supabase);
      setRequests(list);
    } catch (e) {
      console.error('load layanan admin error', e);
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
    <DashboardShell title="Tinjauan Layanan" subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}.`}>
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <ServiceReviewSection
          requests={requests}
          userId={user!.id}
          getAccessToken={getAccessToken}
          onChanged={load}
        />
      )}
    </DashboardShell>
  );
}

function ServiceReviewSection({
  requests,
  userId,
  getAccessToken,
  onChanged,
}: {
  requests: ServiceRequestSummary[];
  userId: string;
  getAccessToken: () => Promise<string | null>;
  onChanged: () => void;
}) {
  const [pendingStatus, setPendingStatus] = useState<Record<string, ServiceStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ServiceRequestSummary | null>(null);

  const handleViewDocuments = async (request: ServiceRequestSummary) => {
    if (request.documentUrls.length === 0) return;
    setOpeningId(request.id);
    setActionError(null);
    try {
      for (const path of request.documentUrls) {
        const signedUrl = await getServiceRequestSignedUrl(supabase, path, 300);
        window.open(signedUrl, '_blank');
      }
    } catch (e) {
      console.error('getServiceRequestSignedUrl error', e);
      setActionError('Gagal membuka dokumen. Coba lagi.');
    } finally {
      setOpeningId(null);
    }
  };

  const submitStatus = async (request: ServiceRequestSummary, status: ServiceStatus, rejectionReason?: string) => {
    setSavingId(request.id);
    setActionError(null);
    try {
      await updateServiceRequestStatus(supabase, request.id, {
        status,
        rejectionReason,
        handledBy: userId,
      });
      onChanged();
    } catch (e) {
      console.error('updateServiceRequestStatus error', e);
      setActionError('Gagal menyimpan status. Coba lagi.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = async (request: ServiceRequestSummary) => {
    const status = pendingStatus[request.id] ?? request.status;
    if (status === 'rejected') {
      setRejectTarget(request);
      return;
    }
    await submitStatus(request, status);
  };

  const handleGeneratePdf = async (request: ServiceRequestSummary) => {
    setGeneratingId(request.id);
    setActionError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setActionError('Sesi berakhir, silakan masuk kembali.');
        return;
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const result = await generateServicePdf(supabaseUrl, accessToken, request.id);
      if (!result.ok) {
        setActionError('Gagal menerbitkan PDF. Coba lagi.');
        return;
      }
      onChanged();
    } catch (e) {
      console.error('generateServicePdf error', e);
      setActionError('Gagal menerbitkan PDF. Coba lagi.');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Permohonan Perlu Ditindak</h2>
      {actionError ? <p style={{ color: THEME.danger, fontSize: 13 }}>{actionError}</p> : null}

      {requests.length === 0 ? (
        <p>Tidak ada permohonan yang perlu ditinjau.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Jenis Layanan</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Diajukan</th>
              <th style={thStyle}>Dokumen</th>
              <th style={thStyle}>Ubah Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const color = serviceStatusColor(r.status, 'light');
              return (
                <tr key={r.id}>
                  <td style={tdStyle}>{serviceTypeName(r.serviceType)}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: color.fg,
                        background: color.bg,
                      }}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td style={tdStyle}>{new Date(r.createdAt).toLocaleString('id-ID')}</td>
                  <td style={tdStyle}>
                    <button
                      style={smallButtonStyle}
                      disabled={r.documentUrls.length === 0 || openingId === r.id}
                      onClick={() => handleViewDocuments(r)}
                    >
                      {openingId === r.id ? 'Membuka…' : 'Lihat Dokumen'}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <select
                      style={selectStyle}
                      value={pendingStatus[r.id] ?? r.status}
                      onChange={(e) =>
                        setPendingStatus((prev) => ({ ...prev, [r.id]: e.target.value as ServiceStatus }))
                      }
                    >
                      {SERVICE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={smallButtonStyle}
                        disabled={savingId === r.id}
                        onClick={() => handleSave(r)}
                      >
                        {savingId === r.id ? 'Menyimpan…' : 'Simpan'}
                      </button>
                      {r.status === 'signing' ? (
                        <button
                          style={smallButtonStyle}
                          disabled={generatingId === r.id}
                          onClick={() => handleGeneratePdf(r)}
                        >
                          {generatingId === r.id ? 'Menerbitkan…' : 'Terbitkan PDF'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {rejectTarget ? (
        <RejectReasonModal
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            const target = rejectTarget;
            setRejectTarget(null);
            void submitStatus(target, 'rejected', reason);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * Modal alasan penolakan — pengganti dialog konfirmasi bawaan browser
 * (tidak bisa distyle, tidak konsisten dengan sisa aplikasi).
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
          Jelaskan alasan penolakan permohonan ini. Alasan wajib diisi.
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
            style={{ ...smallButtonStyle, background: THEME.danger, opacity: trimmed ? 1 : 0.5 }}
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

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: `1px solid ${THEME.border}`,
  padding: '8px 6px',
  color: THEME.textSecondary,
};
const tdStyle: CSSProperties = { borderBottom: `1px solid ${THEME.border}`, padding: '8px 6px' };
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
