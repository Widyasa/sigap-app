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
import { BUDGET_CSV_COLUMNS, colors, dinasName, parseBudgetCsv, statusColor } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { getAccessToken } from '../_lib/session';
import { DashboardShell } from '../_lib/DashboardShell';
import { EmptyState, ErrorState, LoadingState, visuallyHidden } from '../_lib/ui';

const THEME = colors.light;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * Tahun anggaran yang bisa dipilih admin.
 *
 * Dulu halaman ini dipatok `const FISCAL_YEAR = 2026`, sementara importir
 * CSV menerima `fiscal_year` apa pun. Admin yang mengimpor APBD 2027
 * melihat "12 item anggaran berhasil diimpor." lalu tabel yang sama sekali
 * tidak berubah: barisnya ada tapi tak terlihat, tombol indeks ulang tak
 * akan pernah mengindeksnya, dan karena itu ia juga tidak akan pernah
 * muncul di jawaban "Tanya AI" warga. Sejak 1 Januari 2027 seluruh halaman
 * akan menampilkan anggaran tahun lalu.
 */
function fiscalYearOptions(): number[] {
  const now = new Date().getFullYear();
  return [now - 1, now, now + 1];
}

export default function AnggaranAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = user?.role === 'admin';

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

  const [items, setItems] = useState<BudgetIndexStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [fiscalYear, setFiscalYear] = useState(() => new Date().getFullYear());

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await listBudgetIndexStatus(supabase, fiscalYear);
      setItems(rows);
    } catch (e) {
      console.error('listBudgetIndexStatus error', e);
      setError('Gagal memuat data anggaran. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        // Dulu berhenti di sini dengan pesan tanpa jalan keluar.
        setReindexResult({ kind: 'error', text: 'Sesi habis. Mengalihkan ke halaman masuk…' });
        router.replace('/login');
        return;
      }
      const pending = items.filter((it) => !it.isIndexed);
      let success = 0;
      let failed = 0;
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i]!;
        // PRD 11.3: proses lebih dari 3 detik wajib menjelaskan tahapannya.
        // Pengindeksan berjalan satu permintaan jaringan per item, jadi 200
        // item berarti halaman tampak membeku berbanding menit tanpa
        // penanda apa pun.
        setReindexResult({ kind: 'success', text: `Mengindeks ${i + 1} dari ${pending.length}…` });
        const text = budgetItemEmbeddingText(item);
        const result = await embedBudgetItemText(SUPABASE_URL, token, item.id, text);
        if (result.ok) success += 1;
        else failed += 1;
      }
      setReindexResult(
        pending.length === 0
          ? { kind: 'success', text: 'Semua item anggaran sudah terindeks.' }
          : {
              kind: failed > 0 ? 'error' : 'success',
              text:
                failed > 0
                  ? `Selesai: ${success} berhasil diindeks, ${failed} gagal. Kegagalan biasanya berarti layanan AI sedang tidak tersedia.`
                  : `Selesai: ${success} item berhasil diindeks.`,
            },
      );
      await load();
    } catch (e) {
      console.error('reindex budget items error', e);
      setReindexResult({ kind: 'error', text: 'Gagal mengindeks ulang anggaran. Coba lagi.' });
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
      title="Anggaran"
      subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}. Tahun anggaran ${fiscalYear}.`}
      actions={
        <>
          <label htmlFor="tahun-anggaran" style={visuallyHidden}>
            Tahun anggaran
          </label>
          <select
            id="tahun-anggaran"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            style={{
              minHeight: 40,
              padding: '0 12px',
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              fontSize: 16,
              background: THEME.surface,
            }}
          >
            {fiscalYearOptions().map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>
        </>
      }
    >
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {loading ? (
        <LoadingState message="Memuat data anggaran…" />
      ) : error ? null : (
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
            {reindexResult ? (
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 14,
                  // Dulu pesan kegagalan ("Gagal mengimpor…") dirender dengan
                  // warna primer yang sama dengan pesan sukses.
                  color: reindexResult.kind === 'error' ? THEME.danger : THEME.primary,
                }}
              >
                {reindexResult.text}
              </p>
            ) : null}

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
                      Belum ada item anggaran untuk tahun ini. Tempel CSV di bawah untuk mengimpor.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{item.programName}</td>
                      <td style={tdStyle}>{dinasName(item.dinasId)}</td>
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
    if (rows.length === 0) {
      // Tempelan berisi header saja menghasilkan {rows: [], errors: []} —
      // dulu klik tombolnya menghasilkan benar-benar nol umpan balik.
      if (parseErrors.length === 0) {
        setResult('Tidak ada baris data di bawah header. Tambahkan minimal satu baris.');
      }
      return;
    }
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
      <label htmlFor="csv-anggaran" style={visuallyHidden}>
        Data CSV item anggaran
      </label>
      <textarea
        id="csv-anggaran"
        // `wrap="off"` + `white-space: pre`: satu baris anggaran ~120 karakter,
        // jadi dengan pembungkusan lunak kolomnya patah di tengah nilai dan
        // admin yang memeriksa tempelan tidak bisa tahu nilai mana milik
        // kolom mana — satu-satunya hal yang perlu ia lakukan di sini.
        wrap="off"
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: 220,
          fontFamily: 'monospace',
          fontSize: 14,
          whiteSpace: 'pre',
          overflowX: 'auto',
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
