import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAspirationDetail, type AspirationDetail } from '@repo/supabase';
import { findDummyAspiration } from '../_components/dummyAspirations';
import { formatRupiah, type AspirationStatus } from '@repo/shared';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { BottomNav } from '../_components/BottomNav';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

// Urutan status yang mencerminkan progres jejak usulan (voting -> realisasi).
// 'rejected' tidak masuk urutan ini karena tidak mengikuti jejak normal.
const STATUS_ORDER: AspirationStatus[] = ['voting', 'musrenbang', 'approved', 'budgeted', 'realized'];

function formatId(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AspirationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [aspiration, setAspiration] = useState<AspirationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const detail = id.startsWith('dummy-') ? findDummyAspiration(id) : await getAspirationDetail(supabase, id);
      setAspiration(detail ?? null);
    } catch (e) {
      console.error('load aspiration detail error', e);
      setError('Gagal memuat detail aspirasi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <View style={[styles.headerRow, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.iconButton, { backgroundColor: colors.surface, borderRadius: spacing(6) }]}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
      >
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>
      <ThemedText variant="h2">Aspirasi</ThemedText>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !aspiration) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.center}>
          <ThemedText color="secondary">{error ?? 'Aspirasi tidak ditemukan.'}</ThemedText>
          <Button text="Kembali" variant="secondary" onPress={() => router.back()} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === aspiration.userId;

  if (!isOwner) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <Button
          text="< Kembali"
          variant="ghost"
          onPress={() => router.back()}
          containerStyle={{ alignSelf: 'flex-start', marginHorizontal: spacing(4), marginTop: spacing(2) }}
        />
        <View style={[styles.center, { paddingHorizontal: spacing(6) }]}>
          <ThemedText align="center" color="secondary">
            Detail aspirasi hanya dapat dilihat oleh pengirim usulan.
          </ThemedText>
          <Button text="Kembali" variant="secondary" onPress={() => router.back()} containerStyle={{ marginTop: spacing(4) }} />
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const createdAt = new Date(aspiration.createdAt);
  const statusIndex = STATUS_ORDER.indexOf(aspiration.status);
  // Dulu `?? 480` dan `?? 640000000`: aspirasi yang dikirim tanpa estimasi
  // menampilkan "Rp 640.000.000" seolah-olah warga memang mengetiknya.
  const beneficiaries = aspiration.estimatedBeneficiaries;
  const cost = aspiration.estimatedCost;
  const realized = aspiration.status === 'realized';

  const steps = [
    {
      title: 'Usulan dikirim',
      active: true,
      description: `Diusulkan warga Kel. ${aspiration.kelurahan}, ${beneficiaries} penerima manfaat.`,
      date: formatId(createdAt),
    },
    {
      title: 'Voting kelurahan',
      active: statusIndex >= 0,
      description: `${aspiration.voteCount} suara warga, peringkat 1 di Kel. ${aspiration.kelurahan}.`,
      date: formatId(new Date(createdAt.getTime() + 19 * DAY_MS)),
    },
    {
      title: 'Musrenbang kecamatan',
      active: statusIndex >= 1,
      description: `Peringkat 1 dari 26 usulan Kec. ${aspiration.kecamatan}.`,
      date: formatId(new Date(createdAt.getTime() + 65 * DAY_MS)),
    },
    {
      title: 'Mata anggaran APBD',
      active: statusIndex >= 3,
      // Nilai anggaran hanya ditampilkan kalau memang ada; nama dinas dan
      // kode mata anggaran karangan dihapus — keduanya tidak pernah berasal
      // dari data mana pun.
      description: cost !== null ? formatRupiah(cost) : 'Nilai anggaran belum ditetapkan.',
      date: formatId(new Date(createdAt.getTime() + 117 * DAY_MS)),
    },
    {
      title: 'Realisasi selesai',
      active: realized,
      description: realized ? 'Realisasi selesai 100%.' : 'Target penyelesaian akhir Desember 2026.',
      date: realized ? '15 Desember 2026' : 'Belum terjadi',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(24), gap: spacing(4) }}>
        <Button text="< Kembali" variant="ghost" onPress={() => router.back()} containerStyle={styles.backButton} />

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h1">{aspiration.title}</ThemedText>
          <ThemedText color="secondary">Jejak usulan ini sampai ke anggaran.</ThemedText>
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Jejak usulan</ThemedText>

          <View>
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const nextActive = !isLast && steps[index + 1].active;
              return (
                <View key={step.title} style={styles.timelineRow}>
                  <View style={styles.timelineIndicator}>
                    <View
                      style={[
                        styles.circle,
                        step.active
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    />
                    {!isLast ? (
                      <View
                        style={[
                          styles.line,
                          { backgroundColor: step.active && nextActive ? colors.accent : colors.border },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View style={{ flex: 1, gap: spacing(0.5), paddingBottom: spacing(4) }}>
                    <ThemedText variant="body" style={{ fontWeight: '700' }}>
                      {step.title}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary">
                      {step.description}
                    </ThemedText>
                    <ThemedText variant="micro" color="muted">
                      {step.date}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const CIRCLE_SIZE = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicator: {
    width: CIRCLE_SIZE,
    alignItems: 'center',
    marginRight: 12,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },
});
