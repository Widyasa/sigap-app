import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SERVICE_CATALOG, type ServiceCatalogEntry } from '@repo/shared';
import { listMyServiceRequests, type ServiceRequestSummary } from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { ServiceStatusBadge } from './_components/Badge';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

type CategoryFilter = 'Semua' | ServiceCatalogEntry['category'];

const CATEGORY_FILTERS: CategoryFilter[] = ['Semua', 'Kependudukan', 'Sosial', 'Usaha', 'Lainnya'];

function Pill({ label, tone }: { label: string; tone: 'muted' | 'accent' }) {
  const { colors, spacing } = useTheme();
  const bg = tone === 'accent' ? colors.accentSurface : colors.background;
  const fg = tone === 'accent' ? colors.primaryPressed : colors.textSecondary;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg, paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
      ]}
    >
      <ThemedText variant="micro" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function LayananScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [category, setCategory] = useState<CategoryFilter>('Semua');
  const [selectedEntry, setSelectedEntry] = useState<ServiceCatalogEntry | null>(null);

  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const list = await listMyServiceRequests(supabase, user.id);
      setRequests(list);
    } catch (e) {
      console.error('listMyServiceRequests error', e);
      setError('Gagal memuat permohonan. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCatalog = useMemo(
    () =>
      category === 'Semua'
        ? SERVICE_CATALOG
        : SERVICE_CATALOG.filter((entry) => entry.category === category),
    [category],
  );

  const handleApply = useCallback(
    (entry: ServiceCatalogEntry) => {
      setSelectedEntry(null);
      router.push(`/layanan/new?serviceType=${entry.id}`);
    },
    [router],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingVertical: spacing(2) }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">SIGAP</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing(10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing(4), gap: spacing(2) }}
          style={{ marginTop: spacing(2) }}
        >
          {CATEGORY_FILTERS.map((item) => {
            const active = item === category;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    paddingHorizontal: spacing(4),
                    paddingVertical: spacing(2),
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{ color: active ? colors.surface : colors.textPrimary, fontWeight: '600' }}
                >
                  {item}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.titleRow,
            { paddingHorizontal: spacing(4), marginTop: spacing(5), marginBottom: spacing(3) },
          ]}
        >
          <ThemedText variant="h1">
            {category === 'Semua' ? 'Semua layanan' : category}
          </ThemedText>
          <ThemedText variant="caption" color="secondary">
            {filteredCatalog.length} layanan
          </ThemedText>
        </View>

        <View style={{ paddingHorizontal: spacing(4), gap: spacing(3) }}>
          {filteredCatalog.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => setSelectedEntry(entry)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  padding: spacing(3),
                  borderRadius: spacing(4),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconPlaceholder,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              </View>

              <View style={{ flex: 1, gap: spacing(1) }}>
                <ThemedText variant="body" style={{ fontWeight: '700' }}>
                  {entry.name}
                </ThemedText>
                <ThemedText variant="caption" color="secondary" numberOfLines={2}>
                  {entry.description}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) }}>
                  <Pill label={entry.processingTime} tone="muted" />
                  <Pill label={entry.cost} tone="accent" />
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <ThemedText variant="h1" style={{ paddingHorizontal: spacing(4), marginTop: spacing(8) }}>
          Permohonan Saya
        </ThemedText>

        <View style={{ paddingHorizontal: spacing(4), marginTop: spacing(3) }}>
          {error ? (
            <ThemedText color="secondary">{error}</ThemedText>
          ) : loading ? (
            <ThemedText color="secondary">Memuat permohonan…</ThemedText>
          ) : requests.length === 0 ? (
            <ThemedText color="secondary">Belum ada permohonan layanan.</ThemedText>
          ) : (
            <View style={{ gap: spacing(2) }}>
              {requests.map((item) => {
                const catalogEntry = SERVICE_CATALOG.find((c) => c.id === item.serviceType);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/layanan/${item.id}`)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        padding: spacing(3),
                        borderRadius: spacing(3),
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: spacing(1) }}>
                      <ThemedText variant="h2">{catalogEntry?.name ?? item.serviceType}</ThemedText>
                      <ServiceStatusBadge status={item.status} />
                      <ThemedText variant="caption" color="secondary">
                        Diajukan {new Date(item.createdAt).toLocaleDateString('id-ID')}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selectedEntry !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.textPrimary, opacity: 0.4 }]}
          onPress={() => setSelectedEntry(null)}
          accessibilityRole="button"
          accessibilityLabel="Tutup detail layanan"
        />
        {selectedEntry ? (
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: spacing(6),
                borderTopRightRadius: spacing(6),
                padding: spacing(5),
                paddingBottom: spacing(8),
                shadowColor: colors.textPrimary,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <ThemedText variant="h1" style={{ marginTop: spacing(3) }}>
              {selectedEntry.name}
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={{ marginTop: spacing(2) }}>
              {selectedEntry.description}
            </ThemedText>

            <View style={{ flexDirection: 'row', gap: spacing(3), marginTop: spacing(4) }}>
              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.background, padding: spacing(3), borderRadius: spacing(3) },
                ]}
              >
                <ThemedText variant="micro" color="secondary">
                  Estimasi selesai
                </ThemedText>
                <ThemedText variant="body" style={{ fontWeight: '700', marginTop: spacing(1) }}>
                  {selectedEntry.processingTime}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.background, padding: spacing(3), borderRadius: spacing(3) },
                ]}
              >
                <ThemedText variant="micro" color="secondary">
                  Biaya
                </ThemedText>
                <ThemedText variant="body" style={{ fontWeight: '700', marginTop: spacing(1) }}>
                  {selectedEntry.cost}
                </ThemedText>
              </View>
            </View>

            <ThemedText variant="h2" style={{ marginTop: spacing(5), marginBottom: spacing(2) }}>
              Syarat berkas
            </ThemedText>
            <View style={{ gap: spacing(1.5) }}>
              {selectedEntry.requirements.map((req) => (
                <View key={req.key} style={{ flexDirection: 'row', gap: spacing(2) }}>
                  <ThemedText variant="body" color="secondary">
                    •
                  </ThemedText>
                  <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
                    {req.label}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => handleApply(selectedEntry)}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary, borderRadius: spacing(3), marginTop: spacing(6) },
              ]}
            >
              <ThemedText variant="body" style={{ color: colors.surface, fontWeight: '700' }}>
                Ajukan sekarang
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSelectedEntry(null)}
              style={{ alignItems: 'center', marginTop: spacing(3) }}
            >
              <ThemedText variant="body" color="secondary">
                Nanti saja
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 999,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: 999,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  infoCard: {
    flex: 1,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
