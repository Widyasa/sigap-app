'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listBudgetIndexStatus,
  budgetItemEmbeddingText,
  embedBudgetItemText,
  importBudgetItems,
  type BudgetIndexStatus,
} from '@repo/supabase';
import { BUDGET_CSV_COLUMNS, colors, parseBudgetCsv, statusColor } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { getAccessToken } from '../_lib/session';
import { DashboardShell } from '../_lib/DashboardShell';

const THEME = colors.light;

const FISCAL_YEAR = 2026;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export default function AnggaranAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = user?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [items, setItems] = useState<BudgetIndexStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listBudgetIndexStatus(supabase, FISCAL_YEAR);
      setItems(rows);
    } catch (e) {
      console.error('listBudgetIndexStatus error', e);
      setError('Gagal memuat data anggaran. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setReindexResult('Sesi habis. Masuk kembali.');
        return;
      }
      const pending = items.filter((it) => !it.isIndexed);
      let success = 0;
      let failed = 0;
      for (const item of pending) {
        const text = budgetItemEmbeddingText(item);
        const result = await embedBudgetItemText(SUPABASE_URL, token, item.id, text);
        if (result.ok) success += 1;
        else failed += 1;
      }
      setReindexResult(
        pending.length === 0
          ? 'Semua item anggaran sudah terindeks.'
          : `Selesai: ${success} berhasil diindeks, ${failed} gagal.`,
      );
      await load();
    } catch (e) {
      console.error('reindex budget items error', e);
      setReindexResult('Gagal mengindeks ulang anggaran. Coba lagi.');
    } finally {
      setReindexing(false);
    }
  };

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  const pendingCount = items.filter((it) => !it.isIndexed).length;

  return (
    <DashboardShell
      title="Dashboard Anggaran"
      subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}. Tahun anggaran ${FISCAL_YEAR}.`}
    >
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}

      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <>
          <section style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={h2Style}>Status Indeks Pencarian Semantik</h2>
                <p style={{ color: THEME.textSecondary, fontSize: 13 }}>
                  {pendingCount} dari {items.length} item anggaran belum diindeks. Item yang belum
                  diindeks tidak akan muncul di jawaban &ldquo;Tanya AI&rdquo;.
                </p>
              </div>
              <button style={buttonStyle} disabled={reindexing || pendingCount === 0} onClick={handleReindex}>
                {reindexing ? 'Mengindeks…' : 'Indeks ulang anggaran'}
              </button>
            </div>
            {reindexResult ? <p style={{ fontSize: 13, color: THEME.primary }}>{reindexResult}</p> : null}

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Program</th>
                  <th style={thStyle}>Dinas</th>
                  <th style={thStyle}>Status Indeks</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={3}>
                      Belum ada item anggaran.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{item.programName}</td>
                      <td style={tdStyle}>{item.dinasId ?? '-'}</td>
                      <td style={tdStyle}>
                        <span style={item.isIndexed ? indexedBadge : notIndexedBadge}>
                          {item.isIndexed ? 'Terindeks' : 'Belum Terindeks'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
          <BudgetImportSection onImported={load} />
        </>
      )}
    </DashboardShell>
  );
}

const CSV_PLACEHOLDER =
  'fiscal_year,dinas_id,program_name,activity_name,budget_allocated,budget_realized,location_address,kelurahan,kecamatan,progress_percent,contractor\n' +
  '2026,pupr,Pemeliharaan Jalan Kelurahan Sukamaju,Perbaikan aspal,500000000,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';

/**
 * Impor item anggaran baru (kriteria "budget import"). Bentuk MINIMAL yang
 * disengaja: tempel CSV -> parse di klien -> INSERT batch lewat RLS
 * `budget_admin_write`, bukan wizard upload berkas/mapping kolom penuh.
 * Baris hasil impor TIDAK otomatis terindeks untuk pencarian semantik —
 * jalankan "Indeks ulang anggaran" di atas setelahnya.
 */
function BudgetImportSection({ onImported }: { onImported: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleImport = async () => {
    setResult(null);
    const { rows, errors: parseErrors } = parseBudgetCsv(csvText);
    setErrors(parseErrors);
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { inserted } = await importBudgetItems(supabase, rows);
      setResult(`${inserted} item anggaran berhasil diimpor.`);
      setCsvText('');
      onImported();
    } catch (e) {
      console.error('importBudgetItems error', e);
      setResult('Gagal mengimpor item anggaran. Coba lagi.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Impor Item Anggaran (CSV)</h2>
      <p style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 8 }}>
        Tempel CSV dengan header: {BUDGET_CSV_COLUMNS.join(', ')}. Kolom wajib: fiscal_year, program_name,
        budget_allocated.
      </p>
      <textarea
        style={{
          width: '100%',
          minHeight: 140,
          fontFamily: 'monospace',
          fontSize: 12,
          border: `1px solid ${THEME.border}`,
          borderRadius: 6,
          padding: 8,
          boxSizing: 'border-box',
        }}
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={CSV_PLACEHOLDER}
      />
      {errors.length > 0 ? (
        <ul style={{ color: THEME.danger, fontSize: 13 }}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      {result ? <p style={{ fontSize: 13, color: THEME.primary }}>{result}</p> : null}
      <button style={buttonStyle} disabled={importing || csvText.trim().length === 0} onClick={handleImport}>
        {importing ? 'Mengimpor…' : 'Impor CSV'}
      </button>
    </section>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 4 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: `2px solid ${THEME.border}`,
  padding: '8px 6px',
  fontSize: 12,
  color: THEME.textSecondary,
};
const tdStyle: CSSProperties = { borderBottom: `1px solid ${THEME.border}`, padding: '8px 6px' };
const buttonStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: `1px solid ${THEME.primary}`,
  backgroundColor: THEME.primary,
  color: THEME.surface,
  fontSize: 13,
  cursor: 'pointer',
};
const indexedBadge: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  backgroundColor: statusColor('resolved', 'light').bg,
  color: statusColor('resolved', 'light').fg,
};
const notIndexedBadge: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  backgroundColor: statusColor('in_progress', 'light').bg,
  color: statusColor('in_progress', 'light').fg,
};
