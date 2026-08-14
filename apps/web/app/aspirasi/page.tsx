'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listVotingPeriods,
  createVotingPeriod,
  setVotingPeriodActive,
  listAspirationsForReview,
  updateAspirationStatus,
  listBudgetItemsForLinking,
  type VotingPeriod,
  type AspirationSummary,
  type BudgetItemOption,
} from '@repo/supabase';
import {
  createVotingPeriodSchema,
  ASPIRATION_STATUSES,
  type AspirationStatus,
  colors,
} from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';

const THEME = colors.light;

const STATUS_LABELS: Record<AspirationStatus, string> = {
  voting: 'Voting',
  musrenbang: 'Musrenbang',
  approved: 'Disetujui',
  budgeted: 'Dianggarkan',
  realized: 'Terealisasi',
  rejected: 'Ditolak',
};

export default function AspirasiAdminPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = user?.role === 'admin' || user?.role === 'dinas_head';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [periods, setPeriods] = useState<VotingPeriod[]>([]);
  const [aspirations, setAspirations] = useState<AspirationSummary[]>([]);
  const [budgetOptions, setBudgetOptions] = useState<BudgetItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [periodList, reviewList, budgetList] = await Promise.all([
        listVotingPeriods(supabase),
        listAspirationsForReview(supabase),
        listBudgetItemsForLinking(supabase),
      ]);
      setPeriods(periodList);
      setAspirations(reviewList);
      setBudgetOptions(budgetList);
    } catch (e) {
      console.error('load admin aspirasi error', e);
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
    <DashboardShell title="Dashboard Aspirasi" subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}.`}>
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : (
        <>
          <VotingPeriodsSection periods={periods} onChanged={load} />
          <AspirationReviewSection
            aspirations={aspirations}
            budgetOptions={budgetOptions}
            onChanged={load}
          />
        </>
      )}
    </DashboardShell>
  );
}

function VotingPeriodsSection({
  periods,
  onChanged,
}: {
  periods: VotingPeriod[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleCreate = async () => {
    setFormError(null);
    const parsed = createVotingPeriodSchema.safeParse({
      name,
      fiscalYear: Number(fiscalYear),
      startsAt: startsAt ? new Date(startsAt).toISOString() : '',
      endsAt: endsAt ? new Date(endsAt).toISOString() : '',
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data periode tidak valid.');
      return;
    }
    setSubmitting(true);
    try {
      await createVotingPeriod(supabase, parsed.data);
      setName('');
      setStartsAt('');
      setEndsAt('');
      onChanged();
    } catch (e) {
      console.error('createVotingPeriod error', e);
      setFormError('Gagal membuat periode voting. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (period: VotingPeriod) => {
    setTogglingId(period.id);
    try {
      await setVotingPeriodActive(supabase, period.id, !period.isActive);
      onChanged();
    } catch (e) {
      console.error('setVotingPeriodActive error', e);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Periode Voting</h2>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Tahun Anggaran</th>
            <th style={thStyle}>Mulai</th>
            <th style={thStyle}>Selesai</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {periods.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={6}>
                Belum ada periode voting.
              </td>
            </tr>
          ) : (
            periods.map((p) => (
              <tr key={p.id}>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.fiscalYear}</td>
                <td style={tdStyle}>{new Date(p.startsAt).toLocaleString('id-ID')}</td>
                <td style={tdStyle}>{new Date(p.endsAt).toLocaleString('id-ID')}</td>
                <td style={tdStyle}>{p.isActive ? 'Aktif' : 'Ditutup'}</td>
                <td style={tdStyle}>
                  <button
                    style={smallButtonStyle}
                    disabled={togglingId === p.id}
                    onClick={() => handleToggle(p)}
                  >
                    {p.isActive ? 'Tutup' : 'Buka'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 style={h3Style}>Buka Periode Baru</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Nama</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Tahun Anggaran</label>
          <input
            style={{ ...inputStyle, width: 100 }}
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Mulai</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Selesai</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <button style={smallButtonStyle} disabled={submitting} onClick={handleCreate}>
          {submitting ? 'Menyimpan…' : 'Buka Periode'}
        </button>
      </div>
      {formError ? <p style={{ color: THEME.danger, fontSize: 13 }}>{formError}</p> : null}
    </section>
  );
}

function AspirationReviewSection({
  aspirations,
  budgetOptions,
  onChanged,
}: {
  aspirations: AspirationSummary[];
  budgetOptions: BudgetItemOption[];
  onChanged: () => void;
}) {
  const [pendingStatus, setPendingStatus] = useState<Record<string, AspirationStatus>>({});
  const [pendingBudget, setPendingBudget] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSave = async (aspiration: AspirationSummary) => {
    const status = pendingStatus[aspiration.id] ?? aspiration.status;
    const linkedBudgetItemId = pendingBudget[aspiration.id];
    setSavingId(aspiration.id);
    try {
      await updateAspirationStatus(supabase, aspiration.id, {
        status,
        linkedBudgetItemId:
          linkedBudgetItemId !== undefined
            ? linkedBudgetItemId || null
            : undefined,
      });
      onChanged();
    } catch (e) {
      console.error('updateAspirationStatus error', e);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Tinjauan Aspirasi</h2>
      <p style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 12 }}>
        Diurutkan berdasarkan jumlah suara terbanyak. Majukan status sepanjang alur voting →
        musrenbang → disetujui → dianggarkan, dan tautkan item anggaran nyata agar warga bisa
        melihat jejak dampaknya.
      </p>

      {aspirations.length === 0 ? (
        <p>Belum ada aspirasi yang perlu ditinjau.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Judul</th>
              <th style={thStyle}>Kelurahan</th>
              <th style={thStyle}>Suara</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Item Anggaran</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {aspirations.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>{a.title}</td>
                <td style={tdStyle}>{a.kelurahan}</td>
                <td style={tdStyle}>{a.voteCount}</td>
                <td style={tdStyle}>
                  <select
                    style={selectStyle}
                    value={pendingStatus[a.id] ?? a.status}
                    onChange={(e) =>
                      setPendingStatus((prev) => ({ ...prev, [a.id]: e.target.value as AspirationStatus }))
                    }
                  >
                    {ASPIRATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <select
                    style={selectStyle}
                    value={pendingBudget[a.id] ?? a.linkedBudgetItemId ?? ''}
                    onChange={(e) =>
                      setPendingBudget((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                  >
                    <option value="">Belum ditautkan</option>
                    {budgetOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.programName} ({b.fiscalYear})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <button
                    style={smallButtonStyle}
                    disabled={savingId === a.id}
                    onClick={() => handleSave(a)}
                  >
                    {savingId === a.id ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
const h3Style: CSSProperties = { fontSize: 15, marginTop: 20, marginBottom: 8 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: `1px solid ${THEME.border}`,
  padding: '8px 6px',
  color: THEME.textSecondary,
};
const tdStyle: CSSProperties = { borderBottom: `1px solid ${THEME.border}`, padding: '8px 6px' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: THEME.textSecondary, marginBottom: 4 };
const inputStyle: CSSProperties = {
  minHeight: 36,
  border: `1px solid ${THEME.border}`,
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 14,
  boxSizing: 'border-box',
};
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
