import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, ScrollView, TextInput, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import {
  listFeedComplaints,
  listMyUpvotedComplaintIds,
  type FeedComplaint,
} from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { ComplaintCard } from './_components/ComplaintCard';
import { FeedMap } from './_components/FeedMap';
import { BottomNav } from './_components/BottomNav';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';
import { haversineMeters, formatDistance } from './_components/distance';
import { DUMMY_COMPLAINTS } from './_components/dummyComplaints';

type StatusFilter = 'semua' | 'mendesak' | 'diproses' | 'selesai';
type SortOption = 'terbaru' | 'terlama' | 'terdekat' | 'terjauh';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'mendesak', label: 'Mendesak' },
  { id: 'diproses', label: 'Diproses' },
  { id: 'selesai', label: 'Selesai' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'terbaru', label: 'Terbaru' },
  { id: 'terlama', label: 'Terlama' },
  { id: 'terdekat', label: 'Terdekat' },
  { id: 'terjauh', label: 'Terjauh' },
];

export default function FeedScreen() {
  const { user } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [complaints, setComplaints] = useState<FeedComplaint[]>([]);
  const [dukungIds, setDukungIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('terbaru');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortMenuPosition, setSortMenuPosition] = useState<{ top: number; right: number }>({
    top: 120,
    right: 16,
  });
  const sortTriggerRef = useRef<View>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [requestingLocation, setRequestingLocation] = useState(false);

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

  const requestLocation = useCallback(async () => {
    setRequestingLocation(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationPermission('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationPermission('granted');
    } catch (e) {
      console.error('feed location error', e);
      setLocationPermission('denied');
    } finally {
      setRequestingLocation(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);


  /**
   * Aduan contoh HANYA di build pengembangan.
   *
   * Dulu `DUMMY_COMPLAINTS` selalu digabungkan ke feed produksi supaya peta
   * dan daftar "tidak pernah kosong". Akibatnya aduan karangan tampil
   * berdampingan dengan aduan warga sungguhan tanpa penanda apa pun, ikut
   * terhitung di "N aduan di sekitar", bisa difilter dan diurutkan, dan
   * mengetuknya membuka `/aduan/<id-palsu>` yang tidak akan pernah termuat.
   * Pada aplikasi pemerintah, data karangan yang tak bisa dibedakan dari
   * data nyata adalah cacat, bukan fitur — feed kosong ditangani keadaan
   * kosong di bawah.
   */
  const merged = useMemo(
    () => (__DEV__ ? [...complaints, ...DUMMY_COMPLAINTS] : complaints),
    [complaints],
  );

  const distanceMeters = useCallback(
    (c: FeedComplaint) => (coords ? haversineMeters(coords.lat, coords.lng, c.locationLat, c.locationLng) : 0),
    [coords],
  );

  const filtered = useMemo(() => {
    let list = merged;
    if (statusFilter === 'mendesak') list = list.filter((c) => c.urgency === 'P0');
    else if (statusFilter === 'diproses') list = list.filter((c) => c.status === 'in_progress');
    else if (statusFilter === 'selesai') list = list.filter((c) => c.status === 'resolved');

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.title ?? '').toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.category ?? '').toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sortOption === 'terbaru') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOption === 'terlama') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOption === 'terdekat') {
      sorted.sort((a, b) => distanceMeters(a) - distanceMeters(b));
    } else if (sortOption === 'terjauh') {
      sorted.sort((a, b) => distanceMeters(b) - distanceMeters(a));
    }
    return sorted;
  }, [merged, statusFilter, query, sortOption, distanceMeters]);

  const distanceLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const c of merged) {
      labels[c.id] = coords
        ? formatDistance(haversineMeters(coords.lat, coords.lng, c.locationLat, c.locationLng))
        : formatDistance(null);
    }
    return labels;
  }, [merged, coords]);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.id === sortOption)?.label ?? 'Terbaru';

  const openSortMenu = useCallback(() => {
    const node = sortTriggerRef.current;
    if (node) {
      node.measureInWindow((x, y, width, height) => {
        const windowWidth = Dimensions.get('window').width;
        setSortMenuPosition({
          top: y + height + 4,
          right: Math.max(16, windowWidth - (x + width)),
        });
        setSortMenuOpen(true);
      });
    } else {
      setSortMenuPosition({ top: 120, right: 16 });
      setSortMenuOpen(true);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.mapLayer}>
        {locationPermission === 'granted' && coords ? (
          <FeedMap
            complaints={filtered}
            onMarkerPress={(id) => router.push(`/aduan/${id}`)}
            userLocation={coords}
          />
        ) : (
          <View style={[styles.locationGate, { backgroundColor: colors.background, padding: spacing(6) }]}>
            <View
              style={[
                styles.locationGateCard,
                { backgroundColor: colors.surface, borderRadius: spacing(4), padding: spacing(5), gap: spacing(3) },
              ]}
            >
              <ThemedText variant="h2" align="center">
                Aktifkan Lokasi
              </ThemedText>
              <ThemedText color="secondary" align="center">
                Izinkan SIGAP mengakses lokasi agar peta dan jarak aduan bisa ditampilkan.
              </ThemedText>
              <Button
                text="Izinkan Lokasi"
                variant="primary"
                loading={requestingLocation}
                onPress={requestLocation}
                containerStyle={{ marginTop: spacing(2) }}
              />
            </View>
          </View>
        )}
      </View>

      <View
        style={[
          styles.overlay,
          {
            paddingHorizontal: spacing(4),
            paddingTop: spacing(2),
            gap: spacing(3),
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <ThemedText variant="h2">Feed</ThemedText>
        </View>

        <View style={[styles.searchRow, { gap: spacing(2) }]}>
          <View
            style={[
              styles.searchField,
              {
                backgroundColor: colors.surface,
                borderRadius: spacing(6),
                paddingHorizontal: spacing(4),
                gap: spacing(2),
                shadowColor: colors.textPrimary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={user?.kelurahan ? `Cari di Kel. ${user.kelurahan}` : 'Cari aduan'}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.searchInput,
                { color: colors.textPrimary, fontSize: typography.body.fontSize },
              ]}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing(2) }}
        >
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <Button
                key={chip.id}
                text={chip.label}
                variant={active ? 'primary' : 'secondary'}
                onPress={() => setStatusFilter(chip.id)}
                containerStyle={{
                  ...styles.chip,
                  minHeight: 36,
                  paddingVertical: spacing(2),
                  paddingHorizontal: spacing(4),
                  borderRadius: spacing(5),
                  ...(active ? null : { backgroundColor: colors.surface }),
                }}
              />
            );
          })}
        </ScrollView>
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: spacing(5),
            borderTopRightRadius: spacing(5),
            height: sheetExpanded ? '75%' : '22%',
            bottom: insets.bottom + spacing(22),
            shadowColor: colors.textPrimary,
          },
        ]}
      >
        <Pressable
          onPress={() => setSheetExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={sheetExpanded ? 'Perkecil daftar aduan' : 'Perbesar daftar aduan'}
          hitSlop={8}
          style={styles.handleTouchArea}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </Pressable>
        <View style={[styles.sheetHeader, { paddingHorizontal: spacing(4) }]}>
          <ThemedText variant="h2">{merged.length} aduan di sekitar</ThemedText>
          <Pressable
            ref={sortTriggerRef}
            onPress={openSortMenu}
            accessibilityRole="button"
            accessibilityLabel="Urutkan aduan"
            style={styles.sortTrigger}
          >
            <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
              {selectedSortLabel}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={colors.primary} />
          </Pressable>
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
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <ThemedText color="secondary">Belum ada aduan.</ThemedText>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ComplaintCard
                complaint={item}
                hasDukung={dukungIds.has(item.id)}
                distanceLabel={distanceLabels[item.id] ?? '— m'}
                onPress={() => router.push(`/aduan/${item.id}`)}
              />
            )}
          />
        )}
      </View>

      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="none"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <Pressable
          style={[styles.dropdownBackdrop, { backgroundColor: colors.textPrimary, opacity: 0.2 }]}
          onPress={() => setSortMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Tutup menu urutkan"
        />
        <View
          style={[
            styles.sortDropdown,
            {
              top: sortMenuPosition.top,
              right: sortMenuPosition.right,
              backgroundColor: colors.surface,
              borderRadius: spacing(4),
              padding: spacing(2),
              shadowColor: colors.textPrimary,
            },
          ]}
        >
          {SORT_OPTIONS.map((option) => {
            const active = option.id === sortOption;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setSortOption(option.id);
                  setSortMenuOpen(false);
                }}
                style={[
                  styles.sortMenuItem,
                  {
                    paddingVertical: spacing(3),
                    paddingHorizontal: spacing(4),
                    borderRadius: spacing(3),
                    backgroundColor: active ? colors.primarySurface : 'transparent',
                  },
                ]}
              >
                <ThemedText style={{ color: active ? colors.primary : colors.textPrimary, fontWeight: active ? '700' : '400' }}>
                  {option.label}
                </ThemedText>
                {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  locationGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationGateCard: {
    width: '100%',
    maxWidth: 340,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handleTouchArea: {
    paddingTop: 8,
    paddingBottom: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sortDropdown: {
    position: 'absolute',
    width: 180,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
