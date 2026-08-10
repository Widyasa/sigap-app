import { useCallback, useEffect, useState } from 'react';
import { View, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { SlaCountdown } from '../_components/SlaCountdown';
import { TIMELINE_EVENT_LABELS } from '../_components/labels';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

type ComplaintRow = Database['public']['Tables']['complaints']['Row'];

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [hasDukung, setHasDukung] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
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

  // Realtime: baris aduan berubah (status/urgensi/SLA) dan entri timeline baru
  // masuk tanpa reload manual (issue #8, kriteria "Timeline updates without
  // manual reload"). Auth token dilampirkan otomatis lewat accessToken
  // callback di createSigapClient, jadi RLS SELECT tetap berlaku per koneksi.
  useEffect(() => {
    if (!id) return;
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
        <Button text="< Kembali" variant="ghost" onPress={() => router.back()} containerStyle={styles.backButton} />

        {complaint.imageUrls[0] ? (
          <Image source={{ uri: complaint.imageUrls[0] }} style={[styles.photo, { borderRadius: spacing(3) }]} />
        ) : null}

        <View style={{ gap: spacing(2) }}>
          <ThemedText variant="h1">{complaint.title ?? complaint.description}</ThemedText>
          <View style={[styles.badgeRow, { gap: spacing(2) }]}>
            {complaint.urgency ? <UrgencyBadge urgency={complaint.urgency} /> : null}
            <StatusBadge status={complaint.status} />
          </View>
        </View>

        <SlaCountdown createdAt={complaint.createdAt} slaDueAt={complaint.slaDueAt} />

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Deskripsi</ThemedText>
          <ThemedText color="secondary">{complaint.description}</ThemedText>
        </View>

        {complaint.dinasName ? (
          <View style={{ gap: spacing(1) }}>
            <ThemedText variant="h2">Diteruskan ke</ThemedText>
            <ThemedText color="secondary">{complaint.dinasName}</ThemedText>
          </View>
        ) : null}

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Lokasi</ThemedText>
          <ThemedText color="secondary">
            {complaint.locationAddress ?? `${complaint.kelurahan ?? '-'}, ${complaint.kecamatan ?? '-'}`}
          </ThemedText>
        </View>

        <View style={[styles.dukungRow, { gap: spacing(3) }]}>
          <ThemedText color="secondary">{complaint.upvoteCount} warga mendukung</ThemedText>
          <Button
            text={hasDukung ? 'Sudah Didukung' : 'Dukung'}
            variant={hasDukung ? 'ghost' : 'secondary'}
            disabled={hasDukung}
            onPress={handleDukung}
          />
        </View>

        <View style={{ gap: spacing(3) }}>
          <ThemedText variant="h2">Timeline</ThemedText>
          {timeline.length === 0 ? (
            <ThemedText color="secondary">Belum ada progres.</ThemedText>
          ) : (
            timeline.map((entry) => (
              <View
                key={entry.id}
                style={[styles.timelineItem, { borderLeftColor: colors.border, paddingLeft: spacing(3), gap: spacing(1) }]}
              >
                <ThemedText variant="h2">
                  {TIMELINE_EVENT_LABELS[entry.eventType] ?? entry.eventType}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {new Date(entry.createdAt).toLocaleString('id-ID')}
                  {entry.actorName ? ` — ${entry.actorName}` : ''}
                </ThemedText>
                {entry.note ? <ThemedText color="secondary">{entry.note}</ThemedText> : null}
                {entry.photoUrls.length > 0 ? (
                  <ScrollView horizontal contentContainerStyle={{ gap: spacing(2) }}>
                    {entry.photoUrls.map((url) => (
                      <Image key={url} source={{ uri: url }} style={[styles.timelinePhoto, { borderRadius: spacing(2) }]} />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  photo: {
    width: '100%',
    height: 220,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  dukungRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineItem: {
    borderLeftWidth: 2,
  },
  timelinePhoto: {
    width: 100,
    height: 100,
  },
});
