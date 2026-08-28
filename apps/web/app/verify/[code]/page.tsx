'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import { verifyServiceDocument, type VerifyServiceDocumentResult } from '@repo/supabase';
import { SERVICE_CATALOG, SERVICE_STATUSES, type ServiceStatus } from '@repo/shared';
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
  }, [code]);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {loading ? (
          <p>Memeriksa dokumen…</p>
        ) : error ? (
          <p style={{ color: '#DC2626' }}>{error}</p>
        ) : result?.valid ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
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
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={invalidHeadingStyle}>Dokumen Tidak Valid</h1>
            <p style={{ color: '#475569', fontSize: 14 }}>
              Dokumen tidak ditemukan atau kode tidak valid.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
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
  border: '1px solid #E2E8F0',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const validHeadingStyle: CSSProperties = {
  fontSize: 20,
  color: '#16A34A',
  marginBottom: 16,
};

const invalidHeadingStyle: CSSProperties = {
  fontSize: 20,
  color: '#DC2626',
  marginBottom: 8,
};

const dlStyle: CSSProperties = { textAlign: 'left', fontSize: 14 };
const dtStyle: CSSProperties = { color: '#475569', marginTop: 8 };
const ddStyle: CSSProperties = { margin: 0, fontWeight: 600 };
