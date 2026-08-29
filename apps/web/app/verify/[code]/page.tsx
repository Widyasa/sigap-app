'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import { verifyServiceDocument, type VerifyServiceDocumentResult } from '@repo/supabase';
import {
  SERVICE_CATALOG,
  SERVICE_STATUSES,
  colors,
  statusColor,
  spacing,
  typography,
  type ServiceStatus,
} from '@repo/shared';

const THEME = colors.light;
import { supabase } from '../../_lib/supabaseClient';

function serviceTypeName(serviceType: string | null): string {
  if (!serviceType) return '-';
  return SERVICE_CATALOG.find((s) => s.id === serviceType)?.name ?? serviceType;
}

/** Halaman ini dibuka warga/petugas loket lewat pemindaian QR, jadi status
 * harus berbahasa Indonesia — sebelumnya nilai enum mentah ("ready",
 * "collected") tampil apa adanya. */
const STATUS_LABELS: Record<ServiceStatus, string> = {
  submitted: 'Diajukan',
  verifying: 'Diverifikasi',
  signing: 'Diproses Tanda Tangan',
  ready: 'Siap Diunduh',
  rejected: 'Ditolak',
  collected: 'Sudah Diambil',
};

function statusLabel(status: string | null): string {
  if (!status) return '-';
  return SERVICE_STATUSES.includes(status as ServiceStatus)
    ? STATUS_LABELS[status as ServiceStatus]
    : status;
}

export default function VerifyDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [result, setResult] = useState<VerifyServiceDocumentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tombol "Coba Lagi": galat jaringan DULU dirender sebagai teks mati.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    verifyServiceDocument(supabase, code)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        console.error('verifyServiceDocument error', e);
        if (!cancelled) setError('Gagal memeriksa dokumen. Coba lagi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, reloadKey]);

  return (
    <main style={pageStyle}>
      {/* Halaman ini dipindai warga mana pun dengan kameranya, jadi ia butuh
          identitas SIGAP yang terlihat: tanpa itu, halaman verifikasi resmi
          hanyalah kartu putih tanpa merek yang sepele dipalsukan. */}
      <div style={brandRowStyle}>
        <div aria-hidden="true" style={brandMarkStyle}>
          S
        </div>
        <div>
          <div style={{ fontWeight: 700, color: THEME.primary }}>SIGAP</div>
          <div style={{ fontSize: typography.micro.fontSize, color: THEME.textSecondary }}>
            Verifikasi dokumen resmi
          </div>
        </div>
      </div>

      {/* `role="status"` — seluruh isi kartu bertukar secara asinkron dan
          DULU tidak ada yang diumumkan sama sekali, padahal hasil itulah
          satu-satunya alasan halaman ini ada. */}
      <div style={cardStyle} role="status" aria-live="polite">
        {loading ? (
          <p>Memeriksa dokumen…</p>
        ) : error ? (
          <>
            <p style={{ color: THEME.danger }}>{error}</p>
            <button type="button" style={retryStyle} onClick={() => setReloadKey((k) => k + 1)}>
              Coba Lagi
            </button>
          </>
        ) : result?.valid ? (
          <>
            {/* `aria-hidden`: emoji ini duplikat dekoratif dari judul di
                bawahnya, tapi tetap dibacakan ("white heavy check mark"). */}
            <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h1 style={validHeadingStyle}>Dokumen Sah</h1>
            <dl style={dlStyle}>
              <dt style={dtStyle}>Jenis Layanan</dt>
              <dd style={ddStyle}>{serviceTypeName(result.serviceType)}</dd>
              <dt style={dtStyle}>Status</dt>
              <dd style={ddStyle}>{statusLabel(result.status)}</dd>
              <dt style={dtStyle}>Diterbitkan</dt>
              <dd style={ddStyle}>
                {result.issuedAt ? new Date(result.issuedAt).toLocaleString('id-ID') : '-'}
              </dd>
            </dl>
          </>
        ) : (
          <>
            <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={invalidHeadingStyle}>Dokumen Tidak Valid</h1>
            <p style={{ color: THEME.textSecondary, fontSize: typography.body.fontSize }}>
              Dokumen tidak ditemukan atau kode tidak valid.
            </p>
          </>
        )}
        <p style={codeStyle}>Kode: {code}</p>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  boxSizing: 'border-box',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 380,
  padding: 24,
  borderRadius: 12,
  border: `1px solid ${THEME.border}`,
  textAlign: 'center',
  boxSizing: 'border-box',
};

const validHeadingStyle: CSSProperties = {
  fontSize: typography.h1.fontSize,
  // `#16A34A` hanya 3,30:1 — lolos ambang teks besar dengan margin tipis,
  // pada halaman yang dipindai di luar ruangan lewat layar telepon.
  color: statusColor('resolved', 'light').fg,
  marginBottom: 16,
};

const invalidHeadingStyle: CSSProperties = {
  fontSize: typography.h1.fontSize,
  color: THEME.danger,
  marginBottom: 8,
};

const brandRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing(2),
  marginBottom: spacing(4),
};

const brandMarkStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: THEME.primary,
  color: THEME.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
};

const retryStyle: CSSProperties = {
  minHeight: 44,
  marginTop: spacing(3),
  padding: `0 ${spacing(4)}px`,
  borderRadius: 8,
  border: `1px solid ${THEME.primary}`,
  background: 'transparent',
  color: THEME.primary,
  fontSize: typography.body.fontSize,
  fontWeight: 600,
  cursor: 'pointer',
};

const codeStyle: CSSProperties = {
  marginTop: spacing(4),
  fontFamily: 'monospace',
  fontSize: typography.caption.fontSize,
  color: THEME.textSecondary,
};

const dlStyle: CSSProperties = { textAlign: 'left', fontSize: typography.body.fontSize };
const dtStyle: CSSProperties = { color: THEME.textSecondary, marginTop: 8 };
const ddStyle: CSSProperties = { margin: 0, fontWeight: 600 };
