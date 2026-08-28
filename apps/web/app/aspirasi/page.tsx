'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listVotingPeriods,
  createVotingPeriod,
  setVotingPeriodActive,
  listAspirationsForReview,
  nextAspirationStatuses,
  updateAspirationStatus,
  listBudgetItemsForLinking,
  type VotingPeriod,
  type AspirationSummary,
  type BudgetItemOption,
} from '@repo/supabase';
import {
  ASPIRATION_STATUS_LABELS as STATUS_LABELS,
  createVotingPeriodSchema,
  type AspirationStatus,
  colors,
} from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import {
  AsyncSection,
  EmptyState,
  FlashMessage,
  TableScroll,
  Td,
  Th,
  useFlash,
  visuallyHidden,
} from '../_lib/ui';

const THEME = colors.light;


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
    <DashboardShell title="Aspirasi" subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}.`}>
      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : [1]}
        onRetry={load}
        loadingMessage="Memuat data aspirasi…"
        empty={null}
      >
        {() => (
          <>
            {/* Periode voting adalah tulis-ADMIN (`periods_admin` di
                20260810000006_rls.sql). Dulu bagian ini dirender untuk
                `dinas_head` juga, sehingga setiap klik "Buka Periode" atau
                "Tutup" hanya bisa berakhir dengan 42501 dan pesan galat
                yang membingungkan. */}
            {user?.role === 'admin' ? (
              <VotingPeriodsSection periods={periods} onChanged={load} />
            ) : null}
            <AspirationReviewSection
              aspirations={aspirations}
              budgetOptions={budgetOptions}
              onChanged={load}
            />
          </>
        )}
      </AsyncSection>
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
  const [toggleError, setToggleError] = useState<string | null>(null);

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
    setToggleError(null);
    setTogglingId(period.id);
    try {
      await setVotingPeriodActive(supabase, period.id, !period.isActive);
      onChanged();
    } catch (e) {
      // Sebelumnya galat ini hanya masuk console: tombol berhenti berputar
      // dan status periode tidak berubah, tanpa penjelasan apa pun ke admin.
      console.error('setVotingPeriodActive error', e);
      setToggleError(
        period.isActive
          ? 'Gagal menutup periode voting. Coba lagi.'
          : 'Gagal mengaktifkan periode voting. Coba lagi.',
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>Periode Voting</h2>

      <TableScroll caption="Daftar periode voting">
        <thead>
          <tr>
            <Th>Nama</Th>
            <Th>Tahun Anggaran</Th>
            <Th>Mulai</Th>
            <Th>Selesai</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {periods.length === 0 ? (
            <tr>
              <Td colSpan={6}>
                Belum ada periode voting.
              </Td>
            </tr>
          ) : (
            periods.map((p) => (
              <tr key={p.id}>
                <Td>{p.name}</Td>
                <Td>{p.fiscalYear}</Td>
                <Td>{new Date(p.startsAt).toLocaleString('id-ID')}</Td>
                <Td>{new Date(p.endsAt).toLocaleString('id-ID')}</Td>
                <Td>{p.isActive ? 'Aktif' : 'Ditutup'}</Td>
                <Td>
                  <button
                    style={smallButtonStyle}
                    disabled={togglingId === p.id}
                    onClick={() => handleToggle(p)}
                  >
                    {p.isActive ? 'Tutup' : 'Buka'}
                  </button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableScroll>
      {toggleError ? <p style={{ color: THEME.danger, fontSize: 13 }}>{toggleError}</p> : null}

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const { flash, showSuccess } = useFlash();

  const handleSave = async (aspiration: AspirationSummary) => {
    const status = pendingStatus[aspiration.id] ?? aspiration.status;
    const linkedBudgetItemId = pendingBudget[aspiration.id];
    setSavingId(aspiration.id);
    setSaveError(null);
    try {
      await updateAspirationStatus(supabase, aspiration.id, {
        currentStatus: aspiration.status,
        status,
        linkedBudgetItemId:
          linkedBudgetItemId !== undefined
            ? linkedBudgetItemId || null
            : undefined,
      });
      // Bersihkan pilihan lokal supaya dropdown kembali mencerminkan baris
      // di basis data. Dulu nilainya tidak pernah dibersihkan, jadi setelah
      // penyimpanan GAGAL (yang juga senyap) dropdown tetap menampilkan
      // pilihan admin dan UI mengklaim keadaan yang tidak ada di DB.
      setPendingStatus((prev) => {
        const next = { ...prev };
        delete next[aspiration.id];
        return next;
      });
      setPendingBudget((prev) => {
        const next = { ...prev };
        delete next[aspiration.id];
        return next;
      });
      showSuccess('Perubahan aspirasi tersimpan.');
      onChanged();
    } catch (e) {
      // Dulu galat ini hanya masuk console: tombol berhenti berputar,
      // dropdown tetap menampilkan nilai baru, dan admin mengira keputusan
      // Musrenbang sudah tercatat.
      console.error('updateAspirationStatus error', e);
      setSaveError(
        e instanceof Error && e.message.startsWith('Transisi status tidak valid')
          ? 'Perubahan status itu tidak sesuai alur (voting → musrenbang → disetujui → dianggarkan → terealisasi).'
          : 'Gagal menyimpan perubahan aspirasi. Coba lagi.',
      );
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

      <FlashMessage flash={flash} />
      {saveError ? (
        <p role="alert" style={{ color: THEME.danger, fontSize: 13 }}>
          {saveError}
        </p>
      ) : null}

      {aspirations.length === 0 ? (
        <EmptyState
          icon="🗳️"
          title="Belum ada aspirasi yang perlu ditinjau"
          message="Usulan warga muncul di sini setelah masuk masa voting. Buka periode voting baru di atas untuk mulai mengumpulkannya."
        />
      ) : (
        <TableScroll caption="Daftar aspirasi warga untuk ditinjau">
          <thead>
            <tr>
              <Th>Judul</Th>
              <Th>Kelurahan</Th>
              <Th>Suara</Th>
              <Th>Status</Th>
              <Th>Item Anggaran</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {aspirations.map((a) => (
              <tr key={a.id}>
                <Td>{a.title}</Td>
                <Td>{a.kelurahan}</Td>
                <Td>{a.voteCount}</Td>
                <Td>
                  <label htmlFor={`status-aspirasi-${a.id}`} style={visuallyHidden}>
                    Status aspirasi {a.title}
                  </label>
                  <select
                    id={`status-aspirasi-${a.id}`}
                    style={selectStyle}
                    value={pendingStatus[a.id] ?? a.status}
                    onChange={(e) =>
                      setPendingStatus((prev) => ({ ...prev, [a.id]: e.target.value as AspirationStatus }))
                    }
                  >
                    {/* Hanya penerus yang sah — dulu keenam status tampil,
                        sehingga aspirasi yang sudah `budgeted` bisa
                        dikembalikan ke `voting` dan memicu ulang trigger
                        poin Musrenbang. */}
                    {nextAspirationStatuses(a.status).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <label htmlFor={`anggaran-aspirasi-${a.id}`} style={visuallyHidden}>
                    Item anggaran tertaut untuk {a.title}
                  </label>
                  <select
                    id={`anggaran-aspirasi-${a.id}`}
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
                </Td>
                <Td>
                  <button
                    style={smallButtonStyle}
                    disabled={savingId === a.id}
                    onClick={() => handleSave(a)}
                  >
                    {savingId === a.id ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = { marginBottom: 40 };
const h2Style: CSSProperties = { fontSize: 18, marginBottom: 12 };
const h3Style: CSSProperties = { fontSize: 15, marginTop: 20, marginBottom: 8 };
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
