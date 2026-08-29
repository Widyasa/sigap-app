'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listActiveEmergencyAlerts,
  getEmergencyAlertSignedAudioUrl,
  respondToEmergencyAlert,
  resolveEmergencyAlert,
  markFalseAlarm,
  type EmergencyAlertSummary,
} from '@repo/supabase';
import type { Database } from '@repo/supabase';
import {
  EMERGENCY_TYPES,
  formatTimeSince,
  type EmergencyStatus,
  colors,
  emergencyStatusColor,
  urgencyColor,
} from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
import { AsyncSection, EmptyState } from '../_lib/ui';
import { ConfirmModal } from '../_lib/ConfirmModal';

const THEME = colors.light;

type EmergencyAlertRow = Database['public']['Tables']['emergency_alerts']['Row'];

const OPERATOR_ROLES = ['emergency_operator', 'admin'];

const EMERGENCY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMERGENCY_TYPES.map((t) => [t.id, `${t.icon} ${t.label}`]),
);

const STATUS_LABELS: Record<EmergencyStatus, string> = {
  active: 'Menunggu Operator',
  responding: 'Ditanggapi',
  resolved: 'Selesai',
  false_alarm: 'Alarm Palsu',
};

function rowFromRealtime(row: EmergencyAlertRow): EmergencyAlertSummary {
  return {
    id: row.id,
    userId: row.user_id,
    emergencyType: row.emergency_type as EmergencyAlertSummary['emergencyType'],
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    locationAddress: row.location_address,
    audioUrl: row.audio_url,
    note: row.note,
    status: row.status as EmergencyStatus,
    respondedBy: row.responded_by,
    respondedAt: row.responded_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

export default function DaruratOperatorPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const canAccess = !!user?.role && OPERATOR_ROLES.includes(user.role);

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

  const [alerts, setAlerts] = useState<EmergencyAlertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Re-render setiap 30 detik supaya label "waktu sejak" (formatTimeSince)
  // tetap segar tanpa perlu refetch data.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listActiveEmergencyAlerts(supabase);
      setAlerts(list);
    } catch (e) {
      console.error('load darurat operator error', e);
      setError('Gagal memuat data. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess, load]);

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Realtime: antrean darurat berubah (SOS baru masuk, operator lain
  // menanggapi/menutup) tanpa reload manual (issue #12, kriteria "Operator
  // status changes appear in realtime") — pola sama dengan channel di
  // apps/native/app/aduan/[id].tsx (issue #8), diadaptasi untuk client
  // component Next.js. Tidak difilter per-baris karena ini antrean, bukan
  // detail satu alert; RLS `emergency_read` tetap membatasi baris yang
  // benar-benar terkirim lewat koneksi ini ke operator/admin.
  useEffect(() => {
    if (!canAccess) return;
    const channel = supabase
      .channel('emergency-queue')
      .on<EmergencyAlertRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergency_alerts' },
        (payload) => {
          const row = rowFromRealtime(payload.new);
          if (row.status !== 'active' && row.status !== 'responding') return;
          setAlerts((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on<EmergencyAlertRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emergency_alerts' },
        (payload) => {
          const row = rowFromRealtime(payload.new);
          setAlerts((prev) => {
            if (row.status !== 'active' && row.status !== 'responding') {
              return prev.filter((a) => a.id !== row.id);
            }
            const exists = prev.some((a) => a.id === row.id);
            return exists ? prev.map((a) => (a.id === row.id ? row : a)) : [...prev, row];
          });
        },
      )
      .subscribe((status) => {
        // Subtitle halaman menjanjikan "baris terbaru muncul otomatis tanpa
        // reload". Kalau websocket putus (laptop tidur, wifi tersendat),
        // operator menatap antrean basi yang tetap mengaku hidup — dan
        // halaman ini tidak punya tombol muat ulang sama sekali.
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess]);

  // Muat ulang saat tab kembali terlihat: satu-satunya cara memulihkan
  // antrean setelah koneksi realtime sempat putus.
  useEffect(() => {
    if (!canAccess) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [canAccess, load]);

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  const sorted = [...alerts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <DashboardShell
      title="Antrean Darurat SOS"
      subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}. Baris terbaru muncul otomatis tanpa reload.`}
    >
      {!realtimeConnected && !loading ? (
        <div
          role="status"
          style={{
            background: urgencyColor('P1', 'light').bg,
            color: urgencyColor('P1', 'light').fg,
            border: `1px solid ${urgencyColor('P1', 'light').fg}`,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 14,
          }}
        >
          <span>Koneksi realtime terputus — antrean mungkin tidak mutakhir.</span>
          <button type="button" style={smallButtonStyle} onClick={() => void load()}>
            Muat Ulang
          </button>
        </div>
      ) : null}

      <AsyncSection
        loading={loading}
        error={error}
        items={loading ? null : sorted}
        onRetry={load}
        loadingMessage="Memuat antrean SOS…"
        empty={
          <EmptyState
            icon="🛟"
            title="Tidak ada SOS aktif"
            message="Laporan darurat baru akan muncul di sini secara otomatis begitu warga menekan tombol SOS."
          />
        }
      >
        {(items) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((alert) => (
              <AlertCard key={alert.id} alert={alert} operatorId={user!.id} onChanged={load} />
            ))}
          </div>
        )}
      </AsyncSection>
    </DashboardShell>
  );
}

function AlertCard({
  alert,
  operatorId,
  onChanged,
}: {
  alert: EmergencyAlertSummary;
  operatorId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmingFalseAlarm, setConfirmingFalseAlarm] = useState(false);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const color = emergencyStatusColor(alert.status, 'light');
  const mapsUrl = `https://www.google.com/maps?q=${alert.locationLat},${alert.locationLng}`;

  const handleLoadAudio = async () => {
    if (!alert.audioUrl) return;
    setLoadingAudio(true);
    setActionError(null);
    try {
      const signed = await getEmergencyAlertSignedAudioUrl(supabase, alert.audioUrl, 300);
      setAudioUrl(signed);
    } catch (e) {
      console.error('getEmergencyAlertSignedAudioUrl error', e);
      setActionError('Gagal memuat audio. Coba lagi.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      console.error('emergency alert action error', e);
      setActionError(
        e instanceof Error && e.message.startsWith('SOS ini sudah ditanggapi')
          ? e.message
          : 'Gagal menyimpan perubahan. Coba lagi.',
      );
    } finally {
      setBusy(false);
      // Kartu ini DULU hanya mengandalkan event realtime untuk memperbarui
      // dirinya. Kalau realtime tidak tersedia, operator mengeklik
      // "Tanggapi", tombolnya berhenti berputar, tapi lencana tetap
      // "Menunggu Operator" — jadi ia mengeklik lagi dan menimpa
      // responded_by/responded_at operator lain.
      onChanged();
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {EMERGENCY_TYPE_LABELS[alert.emergencyType] ?? alert.emergencyType}
          </div>
          <div style={{ fontSize: 13, color: THEME.textSecondary }}>{formatTimeSince(alert.createdAt)}</div>
        </div>
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
          {STATUS_LABELS[alert.status]}
        </span>
      </div>

      <div style={{ marginTop: 8, fontSize: 14 }}>
        Lokasi: {alert.locationAddress ?? `${alert.locationLat.toFixed(5)}, ${alert.locationLng.toFixed(5)}`}{' '}
        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: THEME.primary }}>
          (buka peta)
        </a>
      </div>

      {alert.note ? <div style={{ marginTop: 4, fontSize: 14 }}>Catatan: {alert.note}</div> : null}

      <div style={{ marginTop: 8 }}>
        {alert.audioUrl ? (
          audioUrl ? (
            <audio controls src={audioUrl} style={{ height: 32 }} />
          ) : (
            <button style={smallButtonStyle} disabled={loadingAudio} onClick={handleLoadAudio}>
              {loadingAudio ? 'Memuat…' : 'Putar Audio'}
            </button>
          )
        ) : (
          <span style={{ fontSize: 13, color: THEME.textMuted }}>Tidak ada audio.</span>
        )}
      </div>

      {actionError ? <p style={{ color: THEME.danger, fontSize: 13, marginTop: 8 }}>{actionError}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          style={smallButtonStyle}
          disabled={busy || alert.status !== 'active'}
          onClick={() => runAction(() => respondToEmergencyAlert(supabase, alert.id, operatorId))}
        >
          Tanggapi
        </button>
        <button
          type="button"
          style={smallButtonStyle}
          // Menutup SOS sama tidak dapat dibatalkannya dengan menandainya
          // alarm palsu (yang sudah punya konfirmasi), dan tombolnya hanya
          // 8px dari "Tanggapi". Menyelesaikan juga menuntut SOS itu sudah
          // ditanggapi lebih dulu.
          disabled={busy || alert.status !== 'responding'}
          title={alert.status !== 'responding' ? 'Tanggapi SOS ini lebih dulu' : undefined}
          onClick={() => setConfirmingResolve(true)}
        >
          {busy ? 'Menyimpan…' : 'Selesai'}
        </button>
        <button
          style={{ ...smallButtonStyle, background: THEME.textMuted }}
          disabled={busy}
          onClick={() => setConfirmingFalseAlarm(true)}
        >
          Tandai Palsu
        </button>
      </div>
      {confirmingResolve ? (
        <ConfirmModal
          title="Tutup SOS"
          message="SOS ini akan ditandai selesai dan hilang dari antrean. Tindakan ini tidak dapat dibatalkan."
          onCancel={() => setConfirmingResolve(false)}
          onConfirm={() => {
            setConfirmingResolve(false);
            runAction(() => resolveEmergencyAlert(supabase, alert.id));
          }}
        />
      ) : null}
      {confirmingFalseAlarm ? (
        <ConfirmModal
          title="Tandai Alarm Palsu"
          message="SOS ini akan ditutup sebagai alarm palsu. Tindakan ini tidak dapat dibatalkan."
          danger
          onCancel={() => setConfirmingFalseAlarm(false)}
          onConfirm={() => {
            setConfirmingFalseAlarm(false);
            runAction(() => markFalseAlarm(supabase, alert.id));
          }}
        />
      ) : null}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 10,
  padding: 16,
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
