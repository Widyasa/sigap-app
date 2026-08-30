import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getComplaint,
  listDuplicateComplaints,
  upvoteComplaint,
  type ComplaintDetail,
  type DuplicateCandidate,
} from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { UrgencyBadge, StatusBadge } from '../_components/Badge';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';
import { formatDistance } from '../_components/distance';

export default function ComplaintDuplicateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, candidates] = await Promise.all([
        getComplaint(supabase, id),
        listDuplicateComplaints(supabase, id),
      ]);
      setComplaint(detail);
      setDuplicates(candidates);
    } catch (e) {
      console.error('load duplicates error', e);
      setError('Gagal memuat daftar aduan serupa.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSupport = useCallback(
    async (duplicate: DuplicateCandidate) => {
      if (!user || !id) return;
      setSupportingId(duplicate.id);
      try {
        await upvoteComplaint(supabase, duplicate.id, user.id);
        const { error: markError } = await supabase
          .from('complaints')
          .update({ duplicate_of: duplicate.id })
          .eq('id', id);
        if (markError) throw markError;
        router.replace(`/aduan/${duplicate.id}`);
      } catch (e) {
        console.error('support duplicate error', e);
        Alert.alert('Gagal', 'Dukungan tidak dapat disimpan. Coba lagi.');
      } finally {
        setSupportingId(null);
      }
    },
    [id, router, user],
  );

  const handleContinue = useCallback(async () => {
    if (!id) return;
    setContinuing(true);
    try {
      router.replace(`/aduan/review/${id}`);
    } finally {
      setContinuing(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText color="secondary" style={{ marginTop: spacing(2) }}>
            Memuat aduan serupa…
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !complaint) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.center, { paddingHorizontal: spacing(4), paddingBottom: insets.bottom }]}>
          <ThemedText color="danger">{error ?? 'Aduan tidak ditemukan.'}</ThemedText>
          <Button
            text="Coba lagi"
            variant="secondary"
            onPress={load}
            containerStyle={{ marginTop: spacing(2) }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">Aduan Serupa</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing(4),
          paddingBottom: insets.bottom + spacing(28),
          gap: spacing(4),
        }}
      >
        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h1">Ada laporan yang mirip</ThemedText>
          <ThemedText variant="body" color="secondary">
            Cek dulu apakah salah satu laporan di bawah ini sama dengan yang Anda maksud.
            Jika iya, dukung laporan itu agar lebih cepat ditindak.
          </ThemedText>
        </View>

        {duplicates.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: spacing(4),
                padding: spacing(4),
                borderWidth: 1,
              },
            ]}
          >
            <ThemedText color="secondary">Tidak ditemukan aduan serupa.</ThemedText>
          </View>
        ) : (
          <View style={{ gap: spacing(3) }}>
            {duplicates.map((duplicate) => (
              <View
                key={duplicate.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: spacing(4),
                    padding: spacing(3),
                    borderWidth: 1,
                    gap: spacing(3),
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', gap: spacing(3) }}>
                  <View
                    style={[
                      styles.thumbPlaceholder,
                      {
                        backgroundColor: colors.background,
                        borderRadius: spacing(3),
                      },
                    ]}
                  >
                    {duplicate.imageUrls[0] ? (
                      <Image
                        source={{ uri: duplicate.imageUrls[0] }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: spacing(1) }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>
                      {duplicate.title}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(1), flexWrap: 'wrap' }}>
                      {duplicate.urgency ? <UrgencyBadge urgency={duplicate.urgency} withCode /> : null}
                      <StatusBadge status={duplicate.status} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) }}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <ThemedText variant="caption" color="secondary">
                          {formatDistance(duplicate.distanceMeters)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) }}>
                        <Ionicons name="thumbs-up-outline" size={14} color={colors.textSecondary} />
                        <ThemedText variant="caption" color="secondary">
                          {duplicate.upvoteCount}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>

                <Button
                  text={supportingId === duplicate.id ? 'Menyimpan…' : 'Dukung laporan ini'}
                  loading={supportingId === duplicate.id}
                  disabled={supportingId !== null && supportingId !== duplicate.id}
                  onPress={() => handleSupport(duplicate)}
                />
              </View>
            ))}
          </View>
        )}

        <Button
          text="Lanjutkan sebagai aduan baru"
          variant="secondary"
          loading={continuing}
          disabled={supportingId !== null}
          onPress={handleContinue}
          containerStyle={{ marginTop: spacing(4) }}
        />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyCard: {
    alignItems: 'center',
  },
  card: {
    flexDirection: 'column',
  },
  thumbPlaceholder: {
    width: 80,
    height: 80,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});
