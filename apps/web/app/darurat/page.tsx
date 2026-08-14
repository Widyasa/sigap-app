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
import { EMERGENCY_TYPES, formatTimeSince, type EmergencyStatus, colors, emergencyStatusColor } from '@repo/shared';
import { useAuth } from '../_lib/auth';
import { supabase } from '../_lib/supabaseClient';
import { DashboardShell } from '../_lib/DashboardShell';
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
    if (!isAuthenticated || !canAccess) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, canAccess, router]);

  const [alerts, setAlerts] = useState<EmergencyAlertSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess]);

  if (authLoading || !isAuthenticated || !canAccess) {
    return <div style={{ padding: 24 }}>Memuat…</div>;
  }

  const sorted = [...alerts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <DashboardShell
      title="Antrean Darurat SOS"
      subtitle={`Masuk sebagai ${user?.fullName ?? user?.role}. Baris terbaru muncul otomatis tanpa reload.`}
    >
      {error ? <p style={{ color: THEME.danger }}>{error}</p> : null}
      {loading ? (
        <p>Memuat data…</p>
      ) : sorted.length === 0 ? (
        <p>Tidak ada SOS aktif saat ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sorted.map((alert) => (
            <AlertCard key={alert.id} alert={alert} operatorId={user!.id} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function AlertCard({ alert, operatorId }: { alert: EmergencyAlertSummary; operatorId: string }) {
  const [busy, setBusy] = useState(false);
  const [confirmingFalseAlarm, setConfirmingFalseAlarm] = useState(false);
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
      setActionError('Gagal menyimpan perubahan. Coba lagi.');
    } finally {
      setBusy(false);
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
          style={smallButtonStyle}
          disabled={busy}
          onClick={() => runAction(() => resolveEmergencyAlert(supabase, alert.id))}
        >
          Selesai
        </button>
        <button
          style={{ ...smallButtonStyle, background: THEME.textMuted }}
          disabled={busy}
          onClick={() => setConfirmingFalseAlarm(true)}
        >
          Tandai Palsu
        </button>
      </div>
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
