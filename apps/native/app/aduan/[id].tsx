import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import * as Location from 'expo-location';
import { DINAS_LIST, getSlaStatus, urgencyColor } from '@repo/shared';
import {
  getComplaint,
  listComplaintTimeline,
  listMyUpvotedComplaintIds,
  upvoteComplaint,
  isDuplicateUpvoteError,
  type ComplaintDetail,
  type TimelineEntry,
} from '@repo/supabase';
import type { Database } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { UrgencyBadge, StatusBadge } from '../_components/Badge';
import { PhotoCarousel } from '../_components/PhotoCarousel';
import { StaticMapPreview } from '../_components/StaticMapPreview';
import { LocationCard } from '../_components/LocationCard';
import { Timeline } from '../_components/Timeline';
import { DinasCard } from '../_components/DinasCard';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';
import { haversineMeters, formatDistance, getDinasName } from '../_components/distance';
import { findDummyComplaint } from '../_components/dummyComplaints';

type ComplaintRow = Database['public']['Tables']['complaints']['Row'];
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const BOTTOM_SHEET_HEIGHT = 96;

/** Ambil inisial dari nama warga (mis. "Rian A." -> "RA") untuk avatar bulat. */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

/** Format tanggal+jam berbahasa Indonesia (mis. "9 Agustus 2026, 07.42"). */
function formatDateID(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  return `${datePart}, ${timePart}`;
}

/** Kode ringkas seperti "#ADU-2026-04871" — tidak ada kolom khusus di DB,
 * jadi diturunkan dari tahun pembuatan + potongan UUID aduan. */
function getDisplayCode(complaint: ComplaintDetail): string {
  const year = new Date(complaint.createdAt).getFullYear();
  const shortId = complaint.id.replace(/-/g, '').slice(0, 5).toUpperCase();
  return `#ADU-${year}-${shortId}`;
}

/** Target penanganan dalam jam: dari `sla_due_at - created_at` jika sudah
 * diklasifikasi, atau dari tabel SLA dinas untuk urgensi aduan jika belum. */
function getTargetHours(complaint: ComplaintDetail): number | null {
  if (complaint.slaDueAt) {
    const ms = new Date(complaint.slaDueAt).getTime() - new Date(complaint.createdAt).getTime();
    return Math.max(0, Math.round(ms / 3_600_000));
  }
  if (complaint.urgency && complaint.assignedDinas) {
    const dinas = DINAS_LIST.find((d) => d.id === complaint.assignedDinas);
    if (dinas) {
      return complaint.urgency === 'P0'
        ? dinas.slaHoursP0
        : complaint.urgency === 'P1'
          ? dinas.slaHoursP1
          : dinas.slaHoursP2;
    }
  }
  return null;
}

/** Timeline deterministik untuk aduan contoh (`dummy-*`) — diturunkan dari
 * status & createdAt-nya karena tidak ada baris `complaint_timeline`
 * sungguhan di database untuk id ini. */
function buildDummyTimeline(complaint: ComplaintDetail): TimelineEntry[] {
  const created = new Date(complaint.createdAt).getTime();
  const stageOrder: ComplaintDetail['status'][] = ['verified', 'in_progress', 'resolved'];
  const reachedIndex = stageOrder.indexOf(complaint.status);
  const entries: TimelineEntry[] = [
    {
      id: -1,
      eventType: 'submitted',
      note: null,
      photoUrls: [],
      createdAt: complaint.createdAt,
      actorId: complaint.userId,
      actorName: complaint.authorName,
    },
  ];
  for (let i = 0; i <= reachedIndex; i += 1) {
    entries.push({
      id: -(i + 2),
      eventType: stageOrder[i],
      note: stageOrder[i] === 'resolved' ? 'Aduan sudah ditindaklanjuti dan dinyatakan selesai.' : null,
      photoUrls: [],
      createdAt: new Date(created + (i + 1) * 60 * 60 * 1000).toISOString(),
      actorId: null,
      actorName: 'Petugas Dinas',
    });
  }
  return entries;
}

function HeaderIconButton({ name, onPress }: { name: IoniconName; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.headerButton,
        { backgroundColor: colors.surface, borderRadius: spacing(6), shadowColor: colors.textPrimary },
      ]}
    >
      <Ionicons name={name} size={20} color={colors.textPrimary} />
    </Pressable>
  );
}

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, mode, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [hasDukung, setHasDukung] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    if (id.startsWith('dummy-')) {
      const dummy = findDummyComplaint(id);
      if (!dummy) {
        setError('Aduan tidak ditemukan.');
        setLoading(false);
        return;
      }
      setComplaint(dummy);
      setTimeline(buildDummyTimeline(dummy));
      setHasDukung(false);
      setLoading(false);
      return;
    }
    try {
      const [detail, entries, mine] = await Promise.all([
        getComplaint(supabase, id),
        listComplaintTimeline(supabase, id),
        user ? listMyUpvotedComplaintIds(supabase, user.id) : Promise.resolve(new Set<string>()),
      ]);
      setComplaint(detail);
      setTimeline(entries);
      setHasDukung(mine.has(id));
    } catch (e) {
      console.error('load complaint detail error', e);
      setError('Gagal memuat detail aduan.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Lokasi perangkat saat ini — hanya untuk label jarak di kartu lokasi;
  // izin ditolak atau gagal diambil tidak menghalangi tampilan detail.
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const position = await Location.getCurrentPositionAsync({});
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch (e) {
        console.error('get current location error', e);
      }
    })();
  }, []);

  // Realtime: baris aduan berubah (status/urgensi/SLA) dan entri timeline baru
  // masuk tanpa reload manual (issue #8, kriteria "Timeline updates without
  // manual reload"). Auth token dilampirkan otomatis lewat accessToken
  // callback di createSigapClient, jadi RLS SELECT tetap berlaku per koneksi.
  useEffect(() => {
    if (!id || id.startsWith('dummy-')) return;
    const channel = supabase
      .channel(`complaint-${id}`)
      .on<ComplaintRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'complaints', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new;
          setComplaint((prev) =>
            prev
              ? {
                  ...prev,
                  status: row.status as ComplaintDetail['status'],
                  urgency: row.urgency as ComplaintDetail['urgency'],
                  title: row.title,
                  category: row.category,
                  assignedDinas: row.assigned_dinas,
                  aiSummary: row.ai_summary,
                  rejectionReason: row.rejection_reason,
                  upvoteCount: row.upvote_count,
                  slaDueAt: row.sla_due_at,
                }
              : prev,
          );
        },
      )
      .on<Database['public']['Tables']['complaint_timeline']['Row']>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaint_timeline', filter: `complaint_id=eq.${id}` },
        (payload) => {
          const row = payload.new;
          setTimeline((prev) =>
            prev.some((e) => e.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    eventType: row.event_type,
                    note: row.note,
                    photoUrls: row.photo_urls,
                    createdAt: row.created_at,
                    actorId: row.actor_id,
                    actorName: null,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleDukung = useCallback(async () => {
    if (!user || !complaint || hasDukung) return;
    setHasDukung(true);
    setComplaint((prev) => (prev ? { ...prev, upvoteCount: prev.upvoteCount + 1 } : prev));
    try {
      await upvoteComplaint(supabase, complaint.id, user.id);
    } catch (e) {
      if (isDuplicateUpvoteError(e)) return;
      console.error('upvoteComplaint error', e);
      setHasDukung(false);
      setComplaint((prev) => (prev ? { ...prev, upvoteCount: prev.upvoteCount - 1 } : prev));
      Alert.alert('Gagal', 'Tidak bisa mendukung aduan ini sekarang. Coba lagi.');
    }
  }, [user, complaint, hasDukung]);

  const handleKomentar = useCallback(() => {
    Alert.alert('Belum tersedia', 'Fitur komentar akan hadir segera.');
  }, []);

  const handleBookmark = useCallback(() => {
    console.log('bookmark pressed', id);
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !complaint) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">{error ?? 'Aduan tidak ditemukan.'}</ThemedText>
          <Button text="Kembali" variant="secondary" onPress={() => router.back()} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      </SafeAreaView>
    );
  }

  const targetHours = getTargetHours(complaint);
  const slaStatus = getSlaStatus(complaint.createdAt, complaint.slaDueAt);
  const progress = complaint.slaDueAt && slaStatus ? Math.max(0.02, 1 - slaStatus.percentRemaining) : 0.05;
  const dinasName = complaint.dinasName ?? getDinasName(complaint.assignedDinas);
  const distanceLabel = userCoords
    ? formatDistance(haversineMeters(userCoords.lat, userCoords.lng, complaint.locationLat, complaint.locationLng))
    : null;
  const markerColor = complaint.urgency ? urgencyColor(complaint.urgency, mode).fg : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: BOTTOM_SHEET_HEIGHT + insets.bottom + spacing(6) }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoCarousel imageUrls={complaint.imageUrls} />

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: spacing(6),
              borderTopRightRadius: spacing(6),
              marginTop: -spacing(6),
              padding: spacing(4),
              gap: spacing(5),
            },
          ]}
        >
          <View style={[styles.badgeRow, { gap: spacing(2) }]}>
            {complaint.urgency ? <UrgencyBadge urgency={complaint.urgency} withCode /> : null}
            <StatusBadge status={complaint.status} />
            <ThemedText variant="caption" color="muted" style={styles.idLabel}>
              {getDisplayCode(complaint)}
            </ThemedText>
          </View>

          <View style={{ gap: spacing(2) }}>
            <ThemedText variant="display">{complaint.title ?? complaint.description}</ThemedText>
            <ThemedText color="secondary">{complaint.description}</ThemedText>
          </View>

          <View style={[styles.authorRow, { gap: spacing(3) }]}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primarySurface, borderRadius: spacing(5) },
              ]}
            >
              <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                {getInitials(complaint.authorName)}
              </ThemedText>
            </View>
            <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
              {complaint.authorName ?? 'Warga'}
              {complaint.kelurahan ? ` · Kel. ${complaint.kelurahan}` : ''} · {formatDateID(complaint.createdAt)}
            </ThemedText>
          </View>

          <View
            style={[
              styles.targetCard,
              { backgroundColor: colors.primarySurface, borderRadius: spacing(4), padding: spacing(4), gap: spacing(2) },
            ]}
          >
            <View style={[styles.targetHeaderRow, { gap: spacing(2) }]}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary, borderRadius: spacing(1) }]} />
              <ThemedText variant="body" style={{ fontWeight: '700', color: colors.primary, flex: 1 }}>
                {targetHours !== null ? `Target penanganan ${targetHours} jam` : 'Menunggu klasifikasi target'}
              </ThemedText>
            </View>
            <ThemedText variant="caption" color="secondary">
              Perhitungan mulai berjalan setelah petugas memverifikasi.
            </ThemedText>
            <View style={[styles.progressTrack, { backgroundColor: colors.surface, borderRadius: spacing(1) }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.primary, borderRadius: spacing(1) },
                ]}
              />
            </View>
          </View>

          <View style={{ gap: spacing(3) }}>
            <StaticMapPreview
              coords={{ lat: complaint.locationLat, lng: complaint.locationLng }}
              markerColor={markerColor}
            />
            <LocationCard
              address={complaint.locationAddress ?? `${complaint.kelurahan ?? '-'}, ${complaint.kecamatan ?? '-'}`}
              distanceLabel={distanceLabel}
            />
          </View>

          <View style={{ gap: spacing(4) }}>
            <ThemedText variant="h2">Riwayat penanganan</ThemedText>
            <Timeline entries={timeline} />
          </View>

          <DinasCard
            dinasName={dinasName}
            category={complaint.category}
            slaHours={targetHours}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.header,
          { top: insets.top + spacing(3), paddingHorizontal: spacing(4) },
        ]}
      >
        <HeaderIconButton name="chevron-back" onPress={() => router.back()} />
        <HeaderIconButton name="bookmark-outline" onPress={handleBookmark} />
      </View>

      <View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: spacing(5),
            borderTopRightRadius: spacing(5),
            paddingHorizontal: spacing(4),
            paddingTop: spacing(3),
            paddingBottom: insets.bottom + spacing(3),
            gap: spacing(3),
            shadowColor: colors.textPrimary,
          },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border, borderRadius: spacing(1) }]} />
        <View style={[styles.sheetRow, { gap: spacing(3) }]}>
          <View style={styles.dukungInfo}>
            <ThemedText variant="h2">{complaint.upvoteCount}</ThemedText>
            <ThemedText variant="micro" color="muted">
              dukungan
            </ThemedText>
          </View>
          <Button
            text="Dukung"
            variant="primary"
            disabled={hasDukung}
            onPress={handleDukung}
            containerStyle={styles.dukungButton}
          />
          <Button text="Komentar" variant="secondary" onPress={handleKomentar} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    minHeight: 200,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  idLabel: {
    marginLeft: 'auto',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCard: {},
  targetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletDot: {
    width: 8,
    height: 8,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dukungInfo: {
    alignItems: 'center',
  },
  dukungButton: {
    flex: 1,
  },
});
