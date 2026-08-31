import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listBudgetItemsByDinas, type BudgetItemListEntry } from '@repo/supabase';
import { DINAS_LIST, formatRupiah } from '@repo/shared';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

const FISCAL_YEAR = 2026;

export default function AnggaranDinasScreen() {
  const { dinasId } = useLocalSearchParams<{ dinasId: string }>();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<BudgetItemListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dinasName = DINAS_LIST.find((d) => d.id === dinasId)?.name ?? dinasId;

  const load = useCallback(async () => {
    if (!dinasId) return;
    setError(null);
    try {
      const rows = await listBudgetItemsByDinas(supabase, dinasId, FISCAL_YEAR);
      setItems(rows);
    } catch (e) {
      console.error('listBudgetItemsByDinas error', e);
      setError('Gagal memuat program/kegiatan dinas ini.');
    } finally {
      setLoading(false);
    }
  }, [dinasId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ padding: spacing(4), gap: spacing(1) }}>
        <ThemedText variant="h1">{dinasName}</ThemedText>
        <ThemedText color="secondary">Program dan kegiatan tahun anggaran {FISCAL_YEAR}</ThemedText>
      </View>

      {error ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          {error}
        </ThemedText>
      ) : loading ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          Memuat…
        </ThemedText>
      ) : items.length === 0 ? (
        <ThemedText color="secondary" style={{ padding: spacing(4) }}>
          Belum ada program anggaran untuk dinas ini.
        </ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(2) }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/anggaran/item/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: spacing(2),
                  padding: spacing(3),
                  gap: spacing(1),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText style={{ fontWeight: '700' }} numberOfLines={2}>
                {item.programName}
              </ThemedText>
              {item.activityName ? (
                <ThemedText color="secondary" variant="caption" numberOfLines={1}>
                  {item.activityName}
                </ThemedText>
              ) : null}
              <ThemedText color="secondary" variant="caption">
                {formatRupiah(item.budgetAllocated)} dialokasikan · {item.progressPercent}% progres
              </ThemedText>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  row: {
    borderWidth: 1,
  },
});
