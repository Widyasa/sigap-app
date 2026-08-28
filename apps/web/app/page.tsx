'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  getRingkasanStats,
  getSlaComplianceDaily,
  getPendingDecisions,
  getComplaintCategoryBreakdown,
  listComplaintsForRingkasan,
  listActiveEmergencyAlerts,
  updateAspirationStatus,
  updateServiceRequestStatus,
  type RingkasanStats,
  type SlaComplianceDay,
  type PendingDecision,
  type ComplaintCategoryBreakdown,
  type RingkasanComplaintRow,
  type EmergencyAlertSummary,
} from '@repo/supabase';
import {
  colors,
  spacing,
  typography,
  statusColor,
  urgencyColor,
  getSlaStatus,
  formatSlaCountdown,
  type ComplaintStatus,
} from '@repo/shared';
import { useAuth, type StaffProfile } from './_lib/auth';
import { supabase } from './_lib/supabaseClient';
import { DashboardShell } from './_lib/DashboardShell';

const THEME = colors.light;

// ---------------------------------------------------------------------
// Cakupan per peran (PRD 8.3 "Cakupan peran di Ringkasan"):
//  - verifier/admin           -> se-kelurahan (seluruh dinas)
//  - dinas_staff/dinas_head   -> dinas sendiri
//  - emergency_operator       -> versi ringkas, halaman ini hanya
//    menampilkan banner SOS + tautan ke /darurat, KPI aduan tidak relevan.
// ---------------------------------------------------------------------
function scopeFor(user: StaffProfile): { kelurahan?: string; dinasId?: string } {
  if (user.role === 'dinas_staff' || user.role === 'dinas_head') {
    return { dinasId: user.dinasId ?? undefined };
  }
  return { kelurahan: user.kelurahan ?? undefined };
}

const STATUS_CHIPS = [
  { id: 'semua', label: 'Semua', statuses: null as ComplaintStatus[] | null },
  { id: 'baru', label: 'Baru', statuses: ['pending_classification', 'pending'] as ComplaintStatus[] },
  { id: 'diproses', label: 'Diproses', statuses: ['verified'] as ComplaintStatus[] },
  { id: 'diteruskan', label: 'Diteruskan', statuses: ['in_progress'] as ComplaintStatus[] },
  { id: 'selesai', label: 'Selesai', statuses: ['resolved'] as ComplaintStatus[] },
  { id: 'ditolak', label: 'Ditolak', statuses: ['rejected'] as ComplaintStatus[] },
] as const;

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Ditindaklanjuti',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

/**
 * Lima pasangan warna yang SUDAH ADA di theme.ts, dirotasi untuk 5 grup
 * kategori (Jalan/Sampah/Air/Penerangan/Keamanan) — bukan hex baru, sama
 * disiplinnya dengan `budgetSectorColor`. Dipilih agar berbeda secara
 * visual: merah (P0), hijau (resolved), biru (P2), amber (in_progress),
 * teal (accent).
 */
const CATEGORY_GROUP_COLORS = [
  urgencyColor('P0', 'light'),
  statusColor('resolved', 'light'),
  urgencyColor('P2', 'light'),
  statusColor('in_progress', 'light'),
  { fg: THEME.accent, bg: THEME.accentSurface },
];

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatTanggalIndonesia(date: Date): string {
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

interface RingkasanData {
  stats: RingkasanStats;
  slaDaily: SlaComplianceDay[];
  pendingDecisions: PendingDecision[];
  categoryBreakdown: ComplaintCategoryBreakdown[];
  complaints: RingkasanComplaintRow[];
}

export default function RingkasanPage() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || !user) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  return <RingkasanContent user={user} />;
}

function RingkasanContent({ user }: { user: StaffProfile }) {
  const scope = useMemo(() => scopeFor(user), [user]);
  const [data, setData] = useState<RingkasanData | null>(null);
  const [alerts, setAlerts] = useState<EmergencyAlertSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState<(typeof STATUS_CHIPS)[number]['id']>('semua');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [stats, slaDaily, pendingDecisions, categoryBreakdown, complaints, activeAlerts] = await Promise.all([
        getRingkasanStats(supabase),
        getSlaComplianceDaily(supabase, 7),
        user.kelurahan ? getPendingDecisions(supabase, user.kelurahan) : Promise.resolve([]),
        getComplaintCategoryBreakdown(supabase, scope),
        listComplaintsForRingkasan(supabase, scope),
        listActiveEmergencyAlerts(supabase),
      ]);
      setData({ stats, slaDaily, pendingDecisions, categoryBreakdown, complaints });
      setAlerts(activeAlerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data Ringkasan.');
    }
  }, [scope, user.kelurahan]);

  useEffect(() => {
    load();
  }, [load]);

  const subtitle = (
    <>
      {user.kelurahan ? `Kelurahan ${user.kelurahan}` : 'Semua wilayah'}
      {user.kecamatan ? ` · Kecamatan ${user.kecamatan}` : ''} · {formatTanggalIndonesia(new Date())}
    </>
  );

  const handleDecision = useCallback(
    async (decision: PendingDecision, approve: boolean) => {
      if (!data) return;
      // Optimis: hapus kartu dulu, lalu tulis ke DB dan segarkan di latar.
      setData({ ...data, pendingDecisions: data.pendingDecisions.filter((d) => d.refId !== decision.refId) });
      try {
        if (decision.source === 'aspirasi') {
          await updateAspirationStatus(supabase, decision.refId, { status: approve ? 'approved' : 'rejected' });
        } else {
          await updateServiceRequestStatus(supabase, decision.refId, {
            status: approve ? 'signing' : 'rejected',
            handledBy: user.id,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memproses keputusan.');
      } finally {
        load();
      }
    },
    [data, load, user.id],
  );

  if (user.role === 'emergency_operator') {
    return (
      <DashboardShell title="Ringkasan" subtitle={subtitle}>
        {error ? <ErrorBox message={error} /> : null}
        <SosBanner alerts={alerts} />
        <p style={{ color: THEME.textSecondary, marginTop: spacing(4) }}>
          Ringkasan penuh (KPI aduan, SLA, dan keputusan) khusus untuk verifikator, staf, dan kepala dinas. Sebagai
          operator darurat, fokus Anda adalah antrean SOS di atas dan halaman{' '}
          <a href="/darurat" style={{ color: THEME.primary }}>
            Darurat
          </a>
          .
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Ringkasan" subtitle={subtitle}>
      {error ? <ErrorBox message={error} /> : null}
      <SosBanner alerts={alerts} />

      {!data ? (
        // Saat `load()` gagal, `data` tetap null — tanpa cek `error` di sini
        // pesan "Memuat…" akan tampil selamanya di bawah kotak galat.
        error ? null : <p style={{ color: THEME.textSecondary }}>Memuat data Ringkasan…</p>
      ) : (
        <>
          <KpiRow stats={data.stats} />

          <div style={mainGridStyle}>
            <section style={{ ...cardStyle, minWidth: 0 }}>
              <div style={{ padding: spacing(4), borderBottom: `1px solid ${THEME.border}` }}>
                <h2 style={sectionTitleStyle}>Aduan masuk</h2>
                <div style={chipRowStyle}>
                  {STATUS_CHIPS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChip(c.id)}
                      style={c.id === chip ? { ...chipStyle, ...chipActiveStyle } : chipStyle}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <ComplaintsTable
                complaints={data.complaints}
                chip={chip}
              />
            </section>

            <div style={sideColumnStyle}>
              <CategoryBreakdownPanel breakdown={data.categoryBreakdown} />
              <SlaCompliancePanel days={data.slaDaily} />
              <PendingDecisionsPanel decisions={data.pendingDecisions} onDecision={handleDecision} />
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: THEME.dangerSurface,
        color: THEME.danger,
        border: `1px solid ${THEME.danger}`,
        borderRadius: 8,
        padding: spacing(3),
        marginBottom: spacing(4),
        fontSize: typography.caption.fontSize,
      }}
    >
      {message}
    </div>
  );
}

function SosBanner({ alerts }: { alerts: EmergencyAlertSummary[] }) {
  if (alerts.length === 0) return null;
  const latest = alerts[0];
  return (
    <div style={sosBannerStyle}>
      <div>
        <strong>{alerts.length} SOS aktif</strong> — terbaru: {latest.emergencyType} di{' '}
        {latest.locationAddress ?? 'lokasi tidak diketahui'}
      </div>
      <a href="/darurat" style={sosButtonStyle}>
        Tangani sekarang
      </a>
    </div>
  );
}

function KpiRow({ stats }: { stats: RingkasanStats }) {
  const resolvedDelta =
    stats.resolvedLastWeekCount > 0
      ? Math.round(((stats.resolvedWeekCount - stats.resolvedLastWeekCount) / stats.resolvedLastWeekCount) * 100)
      : null;

  return (
    <div style={kpiRowStyle}>
      <KpiCard label="Aduan baru hari ini" value={stats.todayCount.toString()} />
      <KpiCard
        label="Menunggu tanggapan"
        value={stats.pendingResponseCount.toString()}
        note={stats.pendingNearSlaCount > 0 ? `${stats.pendingNearSlaCount} mendekati batas SLA` : undefined}
        noteColor={stats.pendingNearSlaCount > 0 ? THEME.danger : undefined}
      />
      <KpiCard
        label="Selesai pekan ini"
        value={stats.resolvedWeekCount.toString()}
        note={resolvedDelta === null ? undefined : `${resolvedDelta >= 0 ? '+' : ''}${resolvedDelta}% vs pekan lalu`}
        noteColor={resolvedDelta !== null && resolvedDelta < 0 ? THEME.danger : THEME.accent}
      />
      <KpiCard
        label="Rata-rata respons"
        value={`${stats.avgResponseHours.toLocaleString('id-ID')} jam`}
        note="Target 6 jam"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  noteColor,
}: {
  label: string;
  value: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div style={kpiCardStyle}>
      <div style={kpiLabelStyle}>{label}</div>
      <div style={kpiValueStyle}>{value}</div>
      {note ? <div style={{ fontSize: typography.micro.fontSize, color: noteColor ?? THEME.textMuted }}>{note}</div> : null}
    </div>
  );
}

function ComplaintsTable({
  complaints,
  chip,
}: {
  complaints: RingkasanComplaintRow[];
  chip: (typeof STATUS_CHIPS)[number]['id'];
}) {
  const activeChip = STATUS_CHIPS.find((c) => c.id === chip)!;
  const filtered = activeChip.statuses
    ? complaints.filter((c) => (activeChip.statuses as string[]).includes(c.status))
    : complaints;

  if (filtered.length === 0) {
    return <p style={{ padding: spacing(4), color: THEME.textSecondary }}>Tidak ada aduan pada filter ini.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <Th>Tiket</Th>
            <Th>Aduan</Th>
            <Th>Kategori</Th>
            <Th>Status</Th>
            <Th>Batas SLA</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => {
            const status = statusColor(c.status as ComplaintStatus, 'light');
            return (
              <tr key={c.id}>
                <Td>
                  <span style={{ fontFamily: 'monospace', fontSize: typography.micro.fontSize }}>
                    {c.id.slice(0, 8).toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <div style={{ fontWeight: 600 }}>{c.title ?? '(Tanpa judul)'}</div>
                  <div style={{ fontSize: typography.micro.fontSize, color: THEME.textMuted }}>
                    {c.reporterName ?? 'Warga'} · {c.address ?? c.assignedDinasName ?? '—'}
                  </div>
                </Td>
                <Td>{c.category ?? '—'}</Td>
                <Td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: `${spacing(1)}px ${spacing(2)}px`,
                      borderRadius: 999,
                      fontSize: typography.micro.fontSize,
                      fontWeight: 600,
                      color: status.fg,
                      background: status.bg,
                    }}
                  >
                    {STATUS_LABELS[c.status as ComplaintStatus] ?? c.status}
                  </span>
                </Td>
                <Td>
                  <SlaCell complaint={c} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlaCell({ complaint }: { complaint: RingkasanComplaintRow }) {
  if (complaint.status === 'resolved') {
    if (!complaint.slaDueAt || !complaint.resolvedAt) return <span style={{ color: THEME.textMuted }}>—</span>;
    const onTime = new Date(complaint.resolvedAt) <= new Date(complaint.slaDueAt);
    return (
      <span style={{ color: onTime ? statusColor('resolved', 'light').fg : THEME.danger, fontSize: typography.micro.fontSize }}>
        {onTime ? 'Tepat waktu' : 'Lewat batas SLA'}
      </span>
    );
  }
  const sla = getSlaStatus(complaint.createdAt, complaint.slaDueAt);
  if (!sla) return <span style={{ color: THEME.textMuted }}>—</span>;
  return (
    <span style={{ color: sla.isCritical ? THEME.danger : THEME.textSecondary, fontSize: typography.micro.fontSize }}>
      {formatSlaCountdown(sla.remainingMs)}
    </span>
  );
}

function CategoryBreakdownPanel({ breakdown }: { breakdown: ComplaintCategoryBreakdown[] }) {
  const max = Math.max(1, ...breakdown.map((b) => b.count));
  return (
    <section style={cardStyle}>
      <div style={panelHeaderStyle}>
        <h2 style={sectionTitleStyle}>Beban per kategori</h2>
      </div>
      <div style={{ padding: spacing(4), display: 'flex', flexDirection: 'column', gap: spacing(3) }}>
        {breakdown.length === 0 ? (
          <p style={{ color: THEME.textSecondary, margin: 0 }}>Belum ada data.</p>
        ) : (
          breakdown.map((b, idx) => {
            const color = CATEGORY_GROUP_COLORS[idx % CATEGORY_GROUP_COLORS.length];
            const widthPercent = Math.round((b.count / max) * 100);
            return (
              <div key={b.groupId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.micro.fontSize, marginBottom: spacing(1) }}>
                  <span>{b.label}</span>
                  <span style={{ color: THEME.textMuted }}>{b.count}</span>
                </div>
                <div style={{ background: THEME.background, borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${widthPercent}%`, height: '100%', background: color.fg, borderRadius: 999 }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function SlaCompliancePanel({ days }: { days: SlaComplianceDay[] }) {
  const values = days.map((d) => d.compliancePercent).filter((v): v is number => v !== null);
  const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return (
    <section style={cardStyle}>
      <div style={{ ...panelHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={sectionTitleStyle}>Kepatuhan SLA</h2>
        {avg !== null ? (
          <span
            style={{
              fontSize: typography.micro.fontSize,
              fontWeight: 700,
              color: statusColor('resolved', 'light').fg,
              background: statusColor('resolved', 'light').bg,
              borderRadius: 999,
              padding: `${spacing(1)}px ${spacing(2)}px`,
            }}
          >
            {avg}% rata-rata
          </span>
        ) : null}
      </div>
      <div style={{ padding: spacing(4), display: 'flex', gap: spacing(2), alignItems: 'flex-end', height: 120 }}>
        {days.map((d) => {
          const dayIndex = new Date(d.day).getDay();
          const heightPercent = d.compliancePercent ?? 0;
          return (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing(1) }}>
              <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end', background: THEME.background, borderRadius: 4 }}>
                {d.compliancePercent !== null ? (
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      background: heightPercent >= 80 ? statusColor('resolved', 'light').fg : urgencyColor('P1', 'light').fg,
                      borderRadius: 4,
                    }}
                  />
                ) : null}
              </div>
              <span style={{ fontSize: typography.micro.fontSize, color: THEME.textMuted }}>{DAY_LABELS[dayIndex]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PendingDecisionsPanel({
  decisions,
  onDecision,
}: {
  decisions: PendingDecision[];
  onDecision: (decision: PendingDecision, approve: boolean) => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={panelHeaderStyle}>
        <h2 style={sectionTitleStyle}>Perlu keputusan</h2>
      </div>
      <div style={{ padding: spacing(4), display: 'flex', flexDirection: 'column', gap: spacing(3) }}>
        {decisions.length === 0 ? (
          <p style={{ color: THEME.textSecondary, margin: 0 }}>Tidak ada keputusan tertunda.</p>
        ) : (
          decisions.map((d) => (
            <div key={`${d.source}-${d.refId}`} style={decisionCardStyle}>
              <div style={{ fontSize: typography.micro.fontSize, color: THEME.textMuted, textTransform: 'uppercase' }}>
                {d.source === 'aspirasi' ? 'Aspirasi' : 'Layanan'}
              </div>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, margin: `${spacing(1)}px 0` }}>{d.title}</div>
              <div style={{ fontSize: typography.micro.fontSize, color: THEME.textMuted, marginBottom: spacing(2) }}>{d.subtitle}</div>
              <div style={{ display: 'flex', gap: spacing(2) }}>
                <button style={approveButtonStyle} onClick={() => onDecision(d, true)}>
                  Setuju
                </button>
                <button style={rejectButtonStyle} onClick={() => onDecision(d, false)}>
                  Tolak
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
  gap: spacing(5),
  marginTop: spacing(5),
  alignItems: 'start',
};

const sideColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing(5),
};

const cardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  overflow: 'hidden',
};

const panelHeaderStyle: CSSProperties = {
  padding: spacing(4),
  borderBottom: `1px solid ${THEME.border}`,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: typography.h2.fontSize,
  fontWeight: typography.h2.fontWeight,
  color: THEME.textPrimary,
  margin: 0,
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  gap: spacing(2),
  marginTop: spacing(3),
  flexWrap: 'wrap',
};

const chipStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  padding: `${spacing(1)}px ${spacing(3)}px`,
  borderRadius: 999,
  border: `1px solid ${THEME.border}`,
  background: THEME.background,
  color: THEME.textSecondary,
  cursor: 'pointer',
};

const chipActiveStyle: CSSProperties = {
  background: THEME.primary,
  color: THEME.surface,
  borderColor: THEME.primary,
  fontWeight: 600,
};

const kpiRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing(4),
};

const kpiCardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  padding: spacing(4),
};

const kpiLabelStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  color: THEME.textMuted,
  marginBottom: spacing(1),
};

const kpiValueStyle: CSSProperties = {
  fontSize: typography.display.fontSize,
  fontWeight: typography.display.fontWeight,
  color: THEME.textPrimary,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: typography.micro.fontSize,
  color: THEME.textMuted,
  padding: `${spacing(3)}px ${spacing(4)}px`,
  borderBottom: `1px solid ${THEME.border}`,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const tdStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  color: THEME.textPrimary,
  padding: `${spacing(3)}px ${spacing(4)}px`,
  borderBottom: `1px solid ${THEME.border}`,
  verticalAlign: 'top',
};

const sosBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing(4),
  background: THEME.dangerSurface,
  border: `1px solid ${THEME.danger}`,
  color: THEME.danger,
  borderRadius: 12,
  padding: spacing(4),
  marginBottom: spacing(5),
  flexWrap: 'wrap',
};

const sosButtonStyle: CSSProperties = {
  background: THEME.danger,
  color: THEME.surface,
  borderRadius: 8,
  padding: `${spacing(2)}px ${spacing(4)}px`,
  fontWeight: 600,
  fontSize: typography.caption.fontSize,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const decisionCardStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 8,
  padding: spacing(3),
};

const approveButtonStyle: CSSProperties = {
  flex: 1,
  fontSize: typography.micro.fontSize,
  fontWeight: 600,
  color: THEME.surface,
  background: statusColor('resolved', 'light').fg,
  border: 'none',
  borderRadius: 6,
  padding: `${spacing(2)}px 0`,
  cursor: 'pointer',
};

const rejectButtonStyle: CSSProperties = {
  flex: 1,
  fontSize: typography.micro.fontSize,
  fontWeight: 600,
  color: THEME.danger,
  background: 'transparent',
  border: `1px solid ${THEME.danger}`,
  borderRadius: 6,
  padding: `${spacing(2)}px 0`,
  cursor: 'pointer',
};
