'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listServiceRequestsForReview,
  getServiceRequestSignedUrl,
  nextServiceStatuses,
  updateServiceRequestStatus,
  generateServicePdf,
  type ServiceRequestSummary,
} from '@repo/supabase';
import {
  SERVICE_CATALOG,
  SERVICE_STATUS_LABELS,
  colors,
  serviceStatusColor,
  spacing,
  typography,
  type ServiceStatus,
} from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import {
  AsyncSection,
  EmptyState,
  FlashMessage,
  Modal,
  TableScroll,
  Td,
  Th,
  dangerButtonStyle,
  secondaryButtonStyle,
  useFlash,
} from '../_lib/ui';

const THEME = colors.light;
const STAFF_ROLES = ['verifier', 'dinas_staff', 'dinas_head', 'admin'];

function serviceTypeName(serviceType: string): string {
  return SERVICE_CATALOG.find((s) => s.id === serviceType)?.name ?? serviceType;
}

export default function LayananAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user, getAccessToken } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && STAFF_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!canAccess) {
      // Peran yang salah BUKAN masalah otentikasi. Melemparnya ke /login
      // membuat petugas yang sudah masuk melihat layar masuk, lalu efek di
      // LoginPage langsung memantulkannya kembali — kedip tak berujung.
      router.replace('/');
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
    <DashboardShell title="Layanan" subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}.`}>
      {/* Satu keadaan saja pada satu waktu. Dulu galat dan keadaan kosong
          dirender bersamaan: saat pengambilan data gagal, petugas melihat
          "Gagal memuat data" DAN "Tidak ada permohonan yang perlu
          ditinjau." tepat di bawahnya. */}
      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : requests}
        onRetry={load}
        loadingMessage="Memuat permohonan layanan…"
        empty={
          <EmptyState
            icon="📄"
            title="Tidak ada permohonan yang perlu ditinjau"
            message="Permohonan baru dari warga akan muncul di sini begitu diajukan."
          />
        }
      >
        {(items) => (
          <ServiceReviewSection
            requests={items}
            userId={user!.id}
            getAccessToken={getAccessToken}
            onChanged={load}
          />
        )}
      </AsyncSection>
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
  const { flash, showSuccess } = useFlash();

  const [documentLinks, setDocumentLinks] = useState<{ request: ServiceRequestSummary; urls: string[] } | null>(null);

  /**
   * Dulu ini `for (…) window.open(await sign(path))`. Hanya `window.open`
   * PERTAMA yang masih membawa aktivasi pengguna; sisanya berjalan setelah
   * `await` dan diblokir setiap peramban modern. Verifikator yang meninjau
   * permohonan berisi 4 dokumen hanya melihat satu tab dan sebuah ikon
   * popup-terblokir yang tidak akan ia sadari. Sekarang seluruh URL
   * ditandatangani lebih dulu lalu ditampilkan sebagai daftar tautan, jadi
   * setiap pembukaan adalah gestur pengguna sungguhan.
   */
  const handleViewDocuments = async (request: ServiceRequestSummary) => {
    if (request.documentUrls.length === 0) return;
    setOpeningId(request.id);
    setActionError(null);
    try {
      const urls = await Promise.all(
        request.documentUrls.map((path) => getServiceRequestSignedUrl(supabase, path, 300)),
      );
      setDocumentLinks({ request, urls });
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
        currentStatus: request.status,
        status,
        rejectionReason,
        handledBy: userId,
      });
      // Bersihkan status tertunda supaya dropdown kembali mencerminkan
      // baris di basis data, bukan pilihan lokal yang mungkin gagal simpan.
      setPendingStatus((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      showSuccess(`Status permohonan diubah menjadi "${SERVICE_STATUS_LABELS[status]}".`);
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
      <FlashMessage flash={flash} />
      {actionError ? (
        <p role="alert" style={{ color: THEME.danger, fontSize: typography.caption.fontSize }}>
          {actionError}
        </p>
      ) : null}

      {(
        <TableScroll caption="Daftar permohonan layanan yang perlu ditindak petugas">
          <thead>
            <tr>
              <Th>Jenis Layanan</Th>
              <Th>Status</Th>
              <Th>Diajukan</Th>
              <Th>Dokumen</Th>
              <Th>Ubah Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const color = serviceStatusColor(r.status, 'light');
              return (
                <tr key={r.id}>
                  <Td>{serviceTypeName(r.serviceType)}</Td>
                  <Td>
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
                      {SERVICE_STATUS_LABELS[r.status]}
                    </span>
                  </Td>
                  <Td>{new Date(r.createdAt).toLocaleString('id-ID')}</Td>
                  <Td>
                    <button
                      style={smallButtonStyle}
                      disabled={r.documentUrls.length === 0 || openingId === r.id}
                      onClick={() => handleViewDocuments(r)}
                    >
                      {openingId === r.id ? 'Membuka…' : 'Lihat Dokumen'}
                    </button>
                  </Td>
                  <Td>
                    <select
                      style={selectStyle}
                      value={pendingStatus[r.id] ?? r.status}
                      onChange={(e) =>
                        setPendingStatus((prev) => ({ ...prev, [r.id]: e.target.value as ServiceStatus }))
                      }
                    >
                      {/* Hanya status penerus yang sah. Dulu keenam status
                          selalu tampil, sehingga permohonan yang baru
                          `submitted` bisa langsung dilompatkan ke `ready` —
                          status yang berarti "surat siap diunduh" padahal
                          output_pdf_url dan verification_code masih NULL. */}
                      {nextServiceStatuses(r.status).map((s) => (
                        <option key={s} value={s}>
                          {SERVICE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
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
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
      )}

      {documentLinks ? (
        <Modal title="Dokumen Permohonan" onClose={() => setDocumentLinks(null)}>
          <p style={{ fontSize: typography.caption.fontSize, color: THEME.textSecondary, marginTop: 0 }}>
            {serviceTypeName(documentLinks.request.serviceType)} · tautan berlaku 5 menit.
          </p>
          <ul style={{ paddingLeft: spacing(5), margin: 0 }}>
            {documentLinks.urls.map((url, i) => (
              <li key={url} style={{ marginBottom: spacing(2) }}>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: THEME.primary }}>
                  Dokumen {i + 1} dari {documentLinks.urls.length}
                </a>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing(4) }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setDocumentLinks(null)}>
              Tutup
            </button>
          </div>
        </Modal>
      ) : null}

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

/** Modal alasan penolakan, memakai primitif `Modal` yang punya
 * role="dialog", jebakan fokus, Escape, dan pengembalian fokus. */
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
        Jelaskan alasan penolakan permohonan ini. Alasan wajib diisi dan ditampilkan ke warga.
      </p>
      <label htmlFor="alasan-tolak-layanan" style={{ display: 'block', fontSize: typography.caption.fontSize, marginBottom: spacing(1) }}>
        Alasan penolakan
      </label>
      <textarea
        id="alasan-tolak-layanan"
        style={textareaStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
      />
      <div style={{ display: 'flex', gap: spacing(2), justifyContent: 'flex-end', marginTop: spacing(4) }}>
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

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
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
