import { useCallback, useEffect, useState } from 'react';
import { Image, View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getBudgetItemDetail, type BudgetItemDetail } from '@repo/supabase';
import { DINAS_LIST, formatRupiah } from '@repo/shared';
import { ThemedText } from '../../_components/ThemedText';
import { Button } from '../../_components/Button';
import { useTheme } from '../../_components/useTheme';
import { supabase } from '../../_components/supabase';

export default function BudgetItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [item, setItem] = useState<BudgetItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const detail = await getBudgetItemDetail(supabase, id);
      setItem(detail);
    } catch (e) {
      console.error('getBudgetItemDetail error', e);
      setError('Gagal memuat detail anggaran.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ThemedText color="secondary">Memuat…</ThemedText>
      </SafeAreaView>
    );
  }

  if (error || !item) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ThemedText color="secondary">{error ?? 'Item anggaran tidak ditemukan.'}</ThemedText>
        <Button text="Kembali" variant="ghost" onPress={() => router.back()} containerStyle={{ marginTop: spacing(3) }} />
      </SafeAreaView>
    );
  }

  const dinasName = DINAS_LIST.find((d) => d.id === item.dinasId)?.name ?? item.dinasId ?? '-';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
        <Button text="< Kembali" variant="ghost" onPress={() => router.back()} containerStyle={styles.backButton} />

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h1">{item.programName}</ThemedText>
          <ThemedText color="secondary">{dinasName}</ThemedText>
          {item.activityName ? <ThemedText color="secondary">{item.activityName}</ThemedText> : null}
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Progres</ThemedText>
          <ThemedText color="secondary">{item.progressPercent}%</ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: colors.border, borderRadius: spacing(1) }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${item.progressPercent}%`,
                  backgroundColor: colors.primary,
                  borderRadius: spacing(1),
                },
              ]}
            />
          </View>
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Anggaran</ThemedText>
          <ThemedText color="secondary">Dianggarkan: {formatRupiah(item.budgetAllocated)}</ThemedText>
          <ThemedText color="secondary">Terealisasi: {formatRupiah(item.budgetRealized)}</ThemedText>
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Lokasi</ThemedText>
          <ThemedText color="secondary">
            {item.locationAddress ?? 'Alamat tidak tersedia'}
          </ThemedText>
          {item.kelurahan || item.kecamatan ? (
            <ThemedText color="secondary">
              {[item.kelurahan, item.kecamatan].filter(Boolean).join(', ')}
            </ThemedText>
          ) : null}
          {item.locationLat !== null && item.locationLng !== null ? (
            <ThemedText variant="caption" color="muted">
              {item.locationLat.toFixed(5)}, {item.locationLng.toFixed(5)}
            </ThemedText>
          ) : null}
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Pelaksana</ThemedText>
          <ThemedText color="secondary">{item.contractor ?? 'Belum ada kontraktor tercatat'}</ThemedText>
        </View>

        {item.photoUrls.length > 0 ? (
          <View style={{ gap: spacing(1) }}>
            <ThemedText variant="h2">Foto</ThemedText>
            <ScrollView horizontal contentContainerStyle={{ gap: spacing(2) }}>
              {item.photoUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={[styles.photo, { borderRadius: spacing(2) }]} />
              ))}
            </ScrollView>
          </View>
        ) : null}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
  },
  photo: {
    width: 140,
    height: 100,
  },
});
