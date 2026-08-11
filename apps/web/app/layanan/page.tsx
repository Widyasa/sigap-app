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
import { SERVICE_CATALOG, SERVICE_STATUSES, type ServiceStatus } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';

const STAFF_ROLES = ['verifier', 'dinas_staff', 'dinas_head', 'admin'];

const STATUS_LABELS: Record<ServiceStatus, string> = {
  submitted: 'Diajukan',
  verifying: 'Diverifikasi',
  signing: 'Ditandatangani',
  ready: 'Siap Diambil',
  rejected: 'Ditolak',
  collected: 'Sudah Diambil',
};

const STATUS_COLORS: Record<ServiceStatus, { fg: string; bg: string }> = {
  submitted: { fg: '#64748B', bg: '#F1F5F9' },
  verifying: { fg: '#0284C7', bg: '#EFF6FF' },
  signing: { fg: '#CA8A04', bg: '#FEFCE8' },
  ready: { fg: '#16A34A', bg: '#F0FDF4' },
  rejected: { fg: '#DC2626', bg: '#FEF2F2' },
  collected: { fg: '#475569', bg: '#F8FAFC' },
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
    <div style={{ width: '100%', maxWidth: 960, padding: 24, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Tinjauan Layanan</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user?.fullName ?? user?.role}.
      </p>

      {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}
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
    </div>
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

  const handleSave = async (request: ServiceRequestSummary) => {
    const status = pendingStatus[request.id] ?? request.status;
    let rejectionReason: string | undefined;
    if (status === 'rejected') {
      const reason = window.prompt('Alasan penolakan:');
      if (!reason) return;
      rejectionReason = reason;
    }
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
      {actionError ? <p style={{ color: '#DC2626', fontSize: 13 }}>{actionError}</p> : null}

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
              const color = STATUS_COLORS[r.status];
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
    </section>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #E2E8F0',
  padding: '8px 6px',
  color: '#475569',
};
const tdStyle: CSSProperties = { borderBottom: '1px solid #E2E8F0', padding: '8px 6px' };
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
