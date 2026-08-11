import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listBudgetSummaryByDinas, type BudgetSummaryByDinas } from '@repo/supabase';
import { formatRupiah } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

const FISCAL_YEAR = 2026;

// Palet warna proporsional untuk kotak treemap — cukup 8 dinas di katalog,
// jadi siklus warna tetap dapat dibedakan tanpa perlu menghitung warna dinamis.
const BOX_COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];

export default function AnggaranScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [summary, setSummary] = useState<BudgetSummaryByDinas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listBudgetSummaryByDinas(supabase, FISCAL_YEAR);
      setSummary(rows);
    } catch (e) {
      console.error('listBudgetSummaryByDinas error', e);
      setError('Gagal memuat data anggaran.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalAllocated = summary.reduce((sum, s) => sum + s.totalAllocated, 0);
  const maxAllocated = summary.reduce((max, s) => Math.max(max, s.totalAllocated), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ padding: spacing(4), gap: spacing(1) }}>
        <ThemedText variant="h1">Anggaran Daerah {FISCAL_YEAR}</ThemedText>
        <ThemedText color="secondary">
          Total dialokasikan: {formatRupiah(totalAllocated)}
        </ThemedText>
        <Button
          text="Tanya AI tentang Anggaran"
          variant="secondary"
          onPress={() => router.push('/anggaran/tanya')}
          containerStyle={{ marginTop: spacing(2) }}
        />
      </View>

      {error ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          {error}
        </ThemedText>
      ) : loading ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          Memuat…
        </ThemedText>
      ) : summary.length === 0 ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          Belum ada data anggaran untuk tahun ini.
        </ThemedText>
      ) : (
        <FlatList
          data={summary}
          keyExtractor={(item) => item.dinasId}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(2) }}
          renderItem={({ item, index }) => {
            // Panjang batang proporsional terhadap dinas dengan alokasi
            // terbesar — memenuhi kriteria "renders budget allocated per
            // dinas" tanpa D3 penuh yang tidak praktis di React Native.
            const widthPercent = Math.max(8, (item.totalAllocated / maxAllocated) * 100);
            return (
              <Pressable
                onPress={() => router.push(`/anggaran/${item.dinasId}`)}
                style={({ pressed }) => [
                  styles.box,
                  { borderRadius: spacing(2), opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText style={{ fontWeight: '700' }}>{item.dinasName}</ThemedText>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: colors.border, borderRadius: spacing(1), marginTop: spacing(1) },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${widthPercent}%`,
                        backgroundColor: BOX_COLORS[index % BOX_COLORS.length],
                        borderRadius: spacing(1),
                      },
                    ]}
                  />
                </View>
                <ThemedText color="secondary" variant="caption" style={{ marginTop: spacing(1) }}>
                  {formatRupiah(item.totalAllocated)} · {item.itemCount} program
                </ThemedText>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  box: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  barTrack: {
    height: 20,
    overflow: 'hidden',
  },
  barFill: {
    height: 20,
  },
});
