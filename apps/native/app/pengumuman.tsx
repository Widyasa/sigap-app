import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  listAnnouncements,
  markAllAnnouncementsAsRead,
  type Announcement,
  type AnnouncementCategoryId,
} from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { AnnouncementCategoryBadge } from './_components/Badge';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';
import { timeAgo } from './_components/timeAgo';

type FilterId = 'semua' | 'belum_dibaca' | AnnouncementCategoryId;

const FILTER_CHIPS: { id: FilterId; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'belum_dibaca', label: 'Belum dibaca' },
  { id: 'infrastruktur', label: 'Infrastruktur' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'layanan', label: 'Layanan' },
  { id: 'kegiatan', label: 'Kegiatan' },
  { id: 'darurat', label: 'Darurat' },
  { id: 'umum', label: 'Umum' },
];

/** Ambil inisial dari nama penulis (mis. "Rian A." -> "RA") untuk avatar bulat. */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export default function PengumumanScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<FilterId>('semua');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listAnnouncements(supabase, user?.kelurahan ?? null, user?.id);
      setAnnouncements(list);
    } catch (e) {
      console.error('load pengumuman error', e);
      setError('Gagal memuat pengumuman. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user) return;
    setMarkingRead(true);
    try {
      await markAllAnnouncementsAsRead(supabase, user.id, user.kelurahan ?? null);
      await load();
    } catch (e) {
      console.error('markAllAnnouncementsAsRead error', e);
    } finally {
      setMarkingRead(false);
    }
  }, [user, load]);

  const filtered = useMemo(
    () =>
      announcements.filter((a) => {
        if (filter === 'semua') return true;
        if (filter === 'belum_dibaca') return !a.isRead;
        return a.category === filter;
      }),
    [announcements, filter],
  );

  const pinned = filtered.filter((a) => a.isPinned);
  const rest = filtered.filter((a) => !a.isPinned);

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
        <Pressable
          onPress={() => console.log('pengumuman menu pressed')}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderRadius: spacing(6) }]}
          accessibilityRole="button"
          accessibilityLabel="Menu"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">{error}</ThemedText>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(a) => a.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: spacing(8) }}
          ListHeaderComponent={
            <View>
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: colors.primary,
                    marginHorizontal: spacing(4),
                    marginTop: spacing(3),
                    borderRadius: spacing(4),
                    padding: spacing(4),
                    gap: spacing(1),
                  },
                ]}
              >
                <View style={styles.bannerRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="h1" style={{ color: colors.surface }}>
                      Pengumuman
                    </ThemedText>
                    {user?.kelurahan ? (
                      <ThemedText variant="caption" style={{ color: colors.accent, marginTop: spacing(1) }}>
                        Kel. {user.kelurahan}
                        {user.kecamatan ? ` · Kec. ${user.kecamatan}` : ''}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={handleMarkAllRead}
                    disabled={markingRead || !user}
                    style={[
                      styles.markReadButton,
                      { backgroundColor: colors.surface, borderRadius: spacing(5), paddingHorizontal: spacing(3) },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Tandai semua dibaca"
                  >
                    <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                      {markingRead ? 'Menandai…' : 'Tandai dibaca'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing(2),
                  paddingHorizontal: spacing(4),
                  paddingVertical: spacing(3),
                }}
              >
                {FILTER_CHIPS.map((chip) => {
                  const active = filter === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setFilter(chip.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                          paddingHorizontal: spacing(3),
                          borderRadius: spacing(5),
                        },
                      ]}
                    >
                      <ThemedText
                        variant="caption"
                        style={{ color: active ? colors.surface : colors.textSecondary, fontWeight: '600' }}
                      >
                        {chip.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {pinned.length > 0 ? (
                <View style={{ paddingHorizontal: spacing(4), gap: spacing(2), marginBottom: spacing(4) }}>
                  <ThemedText variant="caption" color="muted" style={{ fontWeight: '700', letterSpacing: 1 }}>
                    DIPIN
                  </ThemedText>
                  {pinned.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} featured onPress={() => router.push(`/pengumuman/${a.id}`)} />
                  ))}
                </View>
              ) : null}

              <View style={{ paddingHorizontal: spacing(4), marginBottom: spacing(2) }}>
                <ThemedText variant="h2">Terbaru</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {rest.length} pengumuman
                </ThemedText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.center, { padding: spacing(4) }]}>
              <ThemedText color="secondary">Belum ada pengumuman.</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: spacing(4), marginBottom: spacing(3) }}>
              <AnnouncementCard announcement={item} onPress={() => router.push(`/pengumuman/${item.id}`)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function AnnouncementCard({
  announcement,
  featured = false,
  onPress,
}: {
  announcement: Announcement;
  featured?: boolean;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: featured ? colors.primarySurface : colors.surface,
          borderColor: featured ? colors.primary : colors.border,
          padding: spacing(4),
          gap: spacing(2),
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing(2) }]}>
        {announcement.category ? <AnnouncementCategoryBadge category={announcement.category} /> : null}
        {!announcement.isRead ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.civicAmber }]} />
        ) : null}
        <View style={{ flex: 1 }} />
        <ThemedText variant="micro" color="muted">
          {timeAgo(announcement.publishedAt)}
        </ThemedText>
      </View>

      <ThemedText variant={featured ? 'h2' : 'body'} style={{ fontWeight: '700' }} numberOfLines={2}>
        {announcement.title}
      </ThemedText>
      <ThemedText variant="caption" color="secondary" numberOfLines={2}>
        {announcement.body}
      </ThemedText>

      <View style={[styles.row, { gap: spacing(2), marginTop: spacing(1) }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSurface, borderRadius: spacing(4) }]}>
          <ThemedText variant="micro" style={{ color: colors.primary, fontWeight: '700' }}>
            {getInitials(announcement.authorName)}
          </ThemedText>
        </View>
        <ThemedText variant="micro" color="muted">
          {announcement.authorName ?? 'Admin Kelurahan'}
        </ThemedText>
      </View>
    </Pressable>
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {},
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  markReadButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    minHeight: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
