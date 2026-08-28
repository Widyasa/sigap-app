import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  listBudgetSummaryBySector,
  getAspirationBudgetSummary,
  type BudgetSectorSummary,
  type AspirationBudgetSummary,
} from '@repo/supabase';
import { formatRupiah, formatCompactRupiah } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

const FISCAL_YEARS = [2026, 2025, 2024];

// Placeholder — halaman laporan PDF realisasi belum tersedia; tombol ini
// hanya menandai kriteria "PDF report" pada mockup sampai backend generate
// PDF sungguhan ada (lihat pola serupa di `generateServicePdf`, tapi belum
// ada endpoint anggaran-nya).
const BUDGET_REPORT_PLACEHOLDER_URL = 'https://sigap.example.com/laporan/anggaran';

export default function AnggaranScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]);
  const [sectors, setSectors] = useState<BudgetSectorSummary[]>([]);
  const [aspirationBudget, setAspirationBudget] = useState<AspirationBudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const [sectorRows, aspirationSummary] = await Promise.all([
        listBudgetSummaryBySector(supabase, year),
        getAspirationBudgetSummary(supabase, year),
      ]);
      setSectors(sectorRows);
      setAspirationBudget(aspirationSummary);
    } catch (e) {
      console.error('load anggaran error', e);
      setError('Gagal memuat data anggaran. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(fiscalYear);
  }, [load, fiscalYear]);

  const totalAllocated = useMemo(
    () => sectors.reduce((sum, s) => sum + s.totalAllocated, 0),
    [sectors],
  );
  const totalRealized = useMemo(
    () => sectors.reduce((sum, s) => sum + s.totalRealized, 0),
    [sectors],
  );
  const realizedPercent = totalAllocated > 0
    ? Math.min(100, Math.round((totalRealized / totalAllocated) * 100))
    : 0;
  const sisa = Math.max(0, totalAllocated - totalRealized);

  const locationLabel = user?.kelurahan && user?.kecamatan
    ? `Kel. ${user.kelurahan} · Kec. ${user.kecamatan}`
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderRadius: spacing(6) }]}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">SIGAP</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing(10) }}>
        <View style={{ paddingHorizontal: spacing(4), marginTop: spacing(3), gap: spacing(1) }}>
          <ThemedText variant="display">Anggaran</ThemedText>
          {locationLabel ? (
            <ThemedText variant="caption" color="secondary">
              {locationLabel}
            </ThemedText>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing(4), gap: spacing(2) }}
          style={{ marginTop: spacing(3) }}
        >
          {FISCAL_YEARS.map((year) => {
            const active = year === fiscalYear;
            return (
              <Pressable
                key={year}
                onPress={() => setFiscalYear(year)}
                style={[
                  styles.yearChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: colors.primary,
                    paddingHorizontal: spacing(4),
                    paddingVertical: spacing(2),
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{ color: active ? colors.surface : colors.primary, fontWeight: '700' }}
                >
                  {year}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <ThemedText color="secondary" style={{ padding: spacing(4) }}>
            {error}
          </ThemedText>
        ) : loading ? (
          <ThemedText color="secondary" style={{ padding: spacing(4) }}>
            Memuat…
          </ThemedText>
        ) : (
          <>
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.primary,
                  borderRadius: spacing(4),
                  marginHorizontal: spacing(4),
                  padding: spacing(4),
                  marginTop: spacing(4),
                  gap: spacing(3),
                },
              ]}
            >
              <ThemedText variant="caption" style={{ color: colors.surface }}>
                Pagu {fiscalYear}
              </ThemedText>
              <ThemedText variant="display" style={{ color: colors.surface, fontSize: 32, lineHeight: 38 }}>
                {formatCompactRupiah(totalAllocated)}
              </ThemedText>

              <View
                style={[
                  styles.barTrack,
                  { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: spacing(1) },
                ]}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${realizedPercent}%`,
                      backgroundColor: colors.surface,
                      borderRadius: spacing(1),
                    },
                  ]}
                />
              </View>
              <ThemedText variant="micro" style={{ color: colors.surface }}>
                {realizedPercent}% terealisasi
              </ThemedText>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(1) }}>
                <View style={{ gap: spacing(0.5) }}>
                  <ThemedText variant="micro" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    Terealisasi
                  </ThemedText>
                  <ThemedText variant="body" style={{ color: colors.surface, fontWeight: '700' }}>
                    {formatRupiah(totalRealized)}
                  </ThemedText>
                </View>
                <View style={{ gap: spacing(0.5), alignItems: 'flex-end' }}>
                  <ThemedText variant="micro" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    Sisa
                  </ThemedText>
                  <ThemedText variant="body" style={{ color: colors.surface, fontWeight: '700' }}>
                    {formatRupiah(sisa)}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.sectionHeader,
                { paddingHorizontal: spacing(4), marginTop: spacing(6), marginBottom: spacing(3) },
              ]}
            >
              <ThemedText variant="h2">Belanja per bidang</ThemedText>
              <View
                style={[
                  styles.yearBadge,
                  {
                    backgroundColor: colors.primarySurface,
                    borderRadius: spacing(3),
                    paddingHorizontal: spacing(2),
                    paddingVertical: spacing(0.5),
                  },
                ]}
              >
                <ThemedText variant="micro" style={{ color: colors.primary, fontWeight: '700' }}>
                  {fiscalYear}
                </ThemedText>
              </View>
            </View>

            {sectors.length === 0 ? (
              <ThemedText color="secondary" style={{ paddingHorizontal: spacing(4) }}>
                Belum ada data anggaran untuk tahun ini.
              </ThemedText>
            ) : (
              <View style={{ paddingHorizontal: spacing(4), gap: spacing(3) }}>
                {sectors.map((sector) => {
                  const usedPercent = sector.totalAllocated > 0
                    ? Math.min(100, Math.round((sector.totalRealized / sector.totalAllocated) * 100))
                    : 0;
                  return (
                    <View
                      key={sector.sectorId}
                      style={[
                        styles.sectorCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderRadius: spacing(4),
                          padding: spacing(4),
                          gap: spacing(2),
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                        <View
                          style={[
                            styles.sectorDot,
                            { backgroundColor: sector.color.fg, borderRadius: spacing(1) },
                          ]}
                        />
                        <ThemedText variant="body" style={{ fontWeight: '700', flex: 1 }}>
                          {sector.label}
                        </ThemedText>
                        <ThemedText variant="body" style={{ fontWeight: '700' }}>
                          {formatCompactRupiah(sector.totalAllocated)}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.barTrack,
                          { backgroundColor: colors.border, borderRadius: spacing(1), height: 8 },
                        ]}
                      >
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: 8,
                              width: `${usedPercent}%`,
                              backgroundColor: sector.color.fg,
                              borderRadius: spacing(1),
                            },
                          ]}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText variant="micro" color="secondary">
                          {sector.itemCount} kegiatan
                          {sector.categories.length > 0 ? ` · ${sector.categories.join(', ')}` : ''}
                        </ThemedText>
                        <ThemedText variant="micro" color="secondary">
                          {usedPercent}% terpakai
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <ThemedText
              variant="h2"
              style={{ paddingHorizontal: spacing(4), marginTop: spacing(6), marginBottom: spacing(3) }}
            >
              Dari usulan warga
            </ThemedText>
            <View
              style={[
                styles.sectorCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: spacing(4),
                  padding: spacing(4),
                  marginHorizontal: spacing(4),
                  gap: spacing(2),
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.accentSurface, borderRadius: spacing(6) },
                  ]}
                >
                  <Ionicons name="people" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: spacing(0.5) }}>
                  <ThemedText variant="h2">
                    {formatCompactRupiah(aspirationBudget?.totalAllocated ?? 0)}
                  </ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {aspirationBudget?.activityCount ?? 0} kegiatan berasal dari usulan warga yang sudah dianggarkan
                  </ThemedText>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => Linking.openURL(BUDGET_REPORT_PLACEHOLDER_URL)}
              style={({ pressed }) => [
                styles.sectorCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: spacing(4),
                  padding: spacing(4),
                  marginHorizontal: spacing(4),
                  marginTop: spacing(4),
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing(3),
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primarySurface, borderRadius: spacing(6) },
                ]}
              >
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: spacing(0.5) }}>
                <ThemedText variant="body" style={{ fontWeight: '700' }}>
                  Laporan realisasi {fiscalYear}
                </ThemedText>
                <ThemedText variant="micro" color="secondary">
                  PDF · diperbarui berkala oleh Bagian Anggaran
                </ThemedText>
              </View>
              <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
            </Pressable>

            <Button
              text="Tanya AI tentang Anggaran"
              variant="secondary"
              onPress={() => router.push('/anggaran/tanya')}
              containerStyle={{ marginHorizontal: spacing(4), marginTop: spacing(4) }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  yearChip: {
    borderWidth: 1,
    borderRadius: 999,
  },
  summaryCard: {},
  barTrack: {
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearBadge: {},
  sectorCard: {
    borderWidth: 1,
  },
  sectorDot: {
    width: 12,
    height: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
