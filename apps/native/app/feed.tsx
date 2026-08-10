import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  listFeedComplaints,
  listMyUpvotedComplaintIds,
  upvoteComplaint,
  isDuplicateUpvoteError,
  type FeedComplaint,
} from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { ComplaintCard } from './_components/ComplaintCard';
import { FeedMap } from './_components/FeedMap';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

type ViewMode = 'list' | 'map';

export default function FeedScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [complaints, setComplaints] = useState<FeedComplaint[]>([]);
  const [dukungIds, setDukungIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [feed, mine] = await Promise.all([
        listFeedComplaints(supabase),
        user ? listMyUpvotedComplaintIds(supabase, user.id) : Promise.resolve(new Set<string>()),
      ]);
      setComplaints(feed);
      setDukungIds(mine);
    } catch (e) {
      console.error('load feed error', e);
      setError('Gagal memuat feed. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDukung = useCallback(
    async (complaintId: string) => {
      if (!user || dukungIds.has(complaintId)) return;
      // Optimis: tandai sudah dukung dan naikkan hitungan sebelum request selesai,
      // dibatalkan lagi jika gagal (bukan dukung ganda dari DB).
      setDukungIds((prev) => new Set(prev).add(complaintId));
      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? { ...c, upvoteCount: c.upvoteCount + 1 } : c)),
      );
      try {
        await upvoteComplaint(supabase, complaintId, user.id);
      } catch (e) {
        if (isDuplicateUpvoteError(e)) return; // sudah didukung sebelumnya, state sudah benar
        console.error('upvoteComplaint error', e);
        setDukungIds((prev) => {
          const next = new Set(prev);
          next.delete(complaintId);
          return next;
        });
        setComplaints((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, upvoteCount: c.upvoteCount - 1 } : c)),
        );
        Alert.alert('Gagal', 'Tidak bisa mendukung aduan ini sekarang. Coba lagi.');
      }
    },
    [user, dukungIds],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { padding: spacing(4), gap: spacing(3) }]}>
        <ThemedText variant="h1">Feed Aduan</ThemedText>
        <View style={[styles.toggleRow, { gap: spacing(2) }]}>
          <Button
            text="Daftar"
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            onPress={() => setViewMode('list')}
            containerStyle={styles.toggleButton}
          />
          <Button
            text="Peta"
            variant={viewMode === 'map' ? 'primary' : 'ghost'}
            onPress={() => setViewMode('map')}
            containerStyle={styles.toggleButton}
          />
        </View>
      </View>

      {error ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">{error}</ThemedText>
          <Button text="Coba Lagi" variant="secondary" onPress={load} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat feed…</ThemedText>
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Belum ada aduan.</ThemedText>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={complaints}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
          renderItem={({ item }) => (
            <ComplaintCard
              complaint={item}
              hasDukung={dukungIds.has(item.id)}
              onPress={() => router.push(`/aduan/${item.id}`)}
              onDukung={() => handleDukung(item.id)}
            />
          )}
        />
      ) : (
        <FeedMap complaints={complaints} onMarkerPress={(id) => router.push(`/aduan/${id}`)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 0,
  },
  toggleRow: {
    flexDirection: 'row',
  },
  toggleButton: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
