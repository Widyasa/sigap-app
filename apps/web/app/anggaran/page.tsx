'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listBudgetIndexStatus,
  budgetItemEmbeddingText,
  embedBudgetItemText,
  type BudgetIndexStatus,
} from '@repo/supabase';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { getAccessToken } from '../_lib/session';

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
    <div style={{ width: '100%', maxWidth: 960, padding: 24, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Dashboard Anggaran</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Masuk sebagai {user?.fullName ?? user?.role}. Tahun anggaran {FISCAL_YEAR}.
      </p>

      {error ? <p style={{ color: '#DC2626' }}>{error}</p> : null}

      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <>
          <section style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={h2Style}>Status Indeks Pencarian Semantik</h2>
                <p style={{ color: '#475569', fontSize: 13 }}>
                  {pendingCount} dari {items.length} item anggaran belum diindeks. Item yang belum
                  diindeks tidak akan muncul di jawaban "Tanya AI".
                </p>
              </div>
              <button style={buttonStyle} disabled={reindexing || pendingCount === 0} onClick={handleReindex}>
                {reindexing ? 'Mengindeks…' : 'Indeks ulang anggaran'}
              </button>
            </div>
            {reindexResult ? <p style={{ fontSize: 13, color: '#0F4C5C' }}>{reindexResult}</p> : null}

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
        </>
      )}
    </div>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 4 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: '2px solid #CBD5E1',
  padding: '8px 6px',
  fontSize: 12,
  color: '#475569',
};
const tdStyle: CSSProperties = { borderBottom: '1px solid #E2E8F0', padding: '8px 6px' };
const buttonStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #0F4C5C',
  backgroundColor: '#0F4C5C',
  color: '#FFFFFF',
  fontSize: 13,
  cursor: 'pointer',
};
const indexedBadge: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  backgroundColor: '#DCFCE7',
  color: '#166534',
};
const notIndexedBadge: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  backgroundColor: '#FEF3C7',
  color: '#92400E',
};
