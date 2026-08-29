import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  listCitizenLeaderboard,
  type CitizenLeaderboardEntry,
  type LeaderboardTimeFilter,
} from '@repo/supabase';
import { statusColor } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

const TIME_FILTERS: { key: LeaderboardTimeFilter; label: string; heroLabel: string }[] = [
  { key: 'week', label: 'Minggu ini', heroLabel: 'minggu ini' },
  { key: 'month', label: 'Bulan ini', heroLabel: 'bulan ini' },
  { key: 'all', label: 'Semua waktu', heroLabel: 'semua waktu' },
];

const KELURAHAN_CHIP = 'Kelurahan';

/** Inisial dari dua kata pertama nama — dipakai di avatar bulat podium & daftar. */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

function pointsForFilter(entry: CitizenLeaderboardEntry, filter: LeaderboardTimeFilter): number {
  if (filter === 'week') return entry.weekPoints;
  if (filter === 'month') return entry.monthPoints;
  return entry.totalPoints;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [timeFilter, setTimeFilter] = useState<LeaderboardTimeFilter>('month');
  const [rwFilter, setRwFilter] = useState<string | null>(null);
  const [entries, setEntries] = useState<CitizenLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Diambil tanpa filter RW: daftar ini jadi sumber untuk chip RW yang
  // tersedia DAN untuk daftar peringkat (RW difilter di klien) — cukup satu
  // panggilan jaringan per perubahan kelurahan/filter waktu, tanpa refetch
  // setiap kali warga berpindah chip RW.
  const load = useCallback(async () => {
    if (!user?.kelurahan) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listCitizenLeaderboard(supabase, user.kelurahan, null, timeFilter);
      setEntries(rows);
    } catch (e) {
      console.error('load leaderboard error', e);
      setError('Gagal memuat peringkat. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user?.kelurahan, timeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const rwOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((entry) => {
      if (entry.rw) set.add(entry.rw);
    });
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(
    () => (rwFilter ? entries.filter((entry) => entry.rw === rwFilter) : entries),
    [entries, rwFilter],
  );

  const podium = filteredEntries.slice(0, 3);
  const rest = filteredEntries.slice(3);

  const myRank = useMemo(() => {
    const idx = filteredEntries.findIndex((entry) => entry.userId === user?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [filteredEntries, user?.id]);
  const myEntry = filteredEntries.find((entry) => entry.userId === user?.id) ?? null;

  const activeFilter = TIME_FILTERS.find((f) => f.key === timeFilter) ?? TIME_FILTERS[1];
  const resolvedColor = statusColor('resolved', 'light').fg;

  const heroSubtitle = rwFilter
    ? `Kel. ${user?.kelurahan} · RW ${rwFilter.replace(/^RW\s*/i, '')} · ${activeFilter.heroLabel}`
    : `Kel. ${user?.kelurahan} · ${activeFilter.heroLabel}`;

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

      {!user?.kelurahan ? (
        <View style={{ flex: 1, padding: spacing(4), justifyContent: 'center', gap: spacing(3) }}>
          <ThemedText variant="h2" align="center">
            Lengkapi profil Anda
          </ThemedText>
          <ThemedText variant="body" color="secondary" align="center">
            Isi kelurahan pada profil untuk melihat peringkat warga di wilayah Anda.
          </ThemedText>
          <Button text="Lengkapi profil" onPress={() => router.push('/onboarding')} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingBottom: myEntry ? spacing(28) : spacing(10) }}
          >
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.primary,
                  borderRadius: spacing(4),
                  marginHorizontal: spacing(4),
                  marginTop: spacing(3),
                  padding: spacing(4),
                  gap: spacing(3),
                },
              ]}
            >
              <View style={{ gap: spacing(0.5) }}>
                <ThemedText variant="h1" style={{ color: colors.surface }}>
                  Peringkat warga
                </ThemedText>
                <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {heroSubtitle}
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing(2) }}>
                {TIME_FILTERS.map((f) => {
                  const active = f.key === timeFilter;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => setTimeFilter(f.key)}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor: active ? colors.surface : 'transparent',
                          borderColor: colors.surface,
                          paddingHorizontal: spacing(3),
                          paddingVertical: spacing(1.5),
                          borderRadius: spacing(5),
                        },
                      ]}
                    >
                      <ThemedText
                        variant="micro"
                        style={{ color: active ? colors.primary : colors.surface, fontWeight: '700' }}
                      >
                        {f.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {loading ? (
                <ThemedText variant="caption" style={{ color: colors.surface }}>
                  Memuat…
                </ThemedText>
              ) : error ? (
                <ThemedText variant="caption" style={{ color: colors.surface }}>
                  {error}
                </ThemedText>
              ) : podium.length === 0 ? (
                <ThemedText variant="caption" style={{ color: colors.surface }}>
                  Belum ada warga dengan poin di wilayah ini.
                </ThemedText>
              ) : (
                <View style={[styles.podiumRow, { marginTop: spacing(2) }]}>
                  {[podium[1], podium[0], podium[2]].map((entry, i) => {
                    if (!entry) return <View key={`empty-${i}`} style={{ flex: 1 }} />;
                    const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                    const isFirst = rank === 1;
                    const avatarSize = isFirst ? 64 : 52;
                    const pedestalHeight = isFirst ? 72 : rank === 2 ? 52 : 40;
                    return (
                      <View key={entry.userId} style={styles.podiumItem}>
                        <View
                          style={[
                            styles.avatarCircle,
                            {
                              width: avatarSize,
                              height: avatarSize,
                              borderRadius: avatarSize / 2,
                              backgroundColor: colors.surface,
                              borderWidth: isFirst ? 3 : 0,
                              borderColor: colors.civicAmber,
                              marginBottom: spacing(1.5),
                            },
                          ]}
                        >
                          <ThemedText variant="body" style={{ color: colors.primary, fontWeight: '700' }}>
                            {getInitials(entry.fullName)}
                          </ThemedText>
                        </View>
                        <ThemedText
                          variant="caption"
                          numberOfLines={1}
                          style={{ color: colors.surface, fontWeight: '700', maxWidth: 88 }}
                        >
                          {entry.fullName ?? 'Warga'}
                        </ThemedText>
                        <ThemedText variant="micro" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {pointsForFilter(entry, timeFilter)} poin
                        </ThemedText>
                        <View
                          style={[
                            styles.pedestal,
                            {
                              height: pedestalHeight,
                              marginTop: spacing(1.5),
                              borderRadius: spacing(2),
                              backgroundColor: isFirst
                                ? 'rgba(255,255,255,0.35)'
                                : 'rgba(255,255,255,0.2)',
                            },
                          ]}
                        >
                          <ThemedText variant="h2" style={{ color: colors.surface }}>
                            {rank}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing(4), gap: spacing(2) }}
              style={{ marginTop: spacing(3) }}
            >
              <Pressable
                onPress={() => setRwFilter(null)}
                style={[
                  styles.rwChip,
                  {
                    backgroundColor: rwFilter === null ? colors.primary : colors.surface,
                    borderColor: colors.primary,
                    paddingHorizontal: spacing(4),
                    paddingVertical: spacing(2),
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{ color: rwFilter === null ? colors.surface : colors.primary, fontWeight: '700' }}
                >
                  {KELURAHAN_CHIP}
                </ThemedText>
              </Pressable>
              {rwOptions.map((rw) => {
                const active = rw === rwFilter;
                return (
                  <Pressable
                    key={rw}
                    onPress={() => setRwFilter(rw)}
                    style={[
                      styles.rwChip,
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
                      {rw}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: spacing(4),
                marginTop: spacing(4),
              }}
            >
              <ThemedText variant="h2">Peringkat 4 ke atas</ThemedText>
              <ThemedText variant="caption" color="secondary">
                {rest.length} warga
              </ThemedText>
            </View>

            <View style={{ paddingHorizontal: spacing(4), marginTop: spacing(2), gap: spacing(2) }}>
              {rest.map((entry, i) => {
                const rank = i + 4;
                const isMe = entry.userId === user?.id;
                const weekPoints = pointsForFilter(entry, 'week');
                return (
                  <View
                    key={entry.userId}
                    style={[
                      styles.listItem,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: spacing(3),
                        padding: spacing(3),
                        borderWidth: isMe ? 2 : 1,
                        borderColor: isMe ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <ThemedText variant="body" color="secondary" style={{ width: spacing(6), fontWeight: '700' }}>
                      {rank}
                    </ThemedText>
                    <View
                      style={[
                        styles.avatarCircleSmall,
                        { backgroundColor: colors.primarySurface, marginRight: spacing(3) },
                      ]}
                    >
                      <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                        {getInitials(entry.fullName)}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                        {isMe ? `${entry.fullName ?? 'Anda'} (Anda)` : entry.fullName ?? 'Warga'}
                      </ThemedText>
                      <ThemedText variant="micro" color="secondary">
                        {entry.rw ?? '-'} · {entry.contributionCount} kontribusi
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText variant="body" style={{ fontWeight: '700' }}>
                        {pointsForFilter(entry, timeFilter)}
                      </ThemedText>
                      <ThemedText variant="micro" style={{ color: resolvedColor }}>
                        +{weekPoints} pekan ini
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
              {!loading && !error && rest.length === 0 && filteredEntries.length > 0 ? (
                <ThemedText variant="caption" color="secondary" style={{ textAlign: 'center', padding: spacing(2) }}>
                  Semua warga wilayah ini sudah tampil di podium.
                </ThemedText>
              ) : null}
            </View>

            <ThemedText
              variant="micro"
              color="muted"
              align="center"
              style={{ marginTop: spacing(6), paddingHorizontal: spacing(6) }}
            >
              Peringkat diperbarui setiap pukul 00.00 WIB. Nama ditampilkan sesuai izin privasi masing-masing warga.
            </ThemedText>
          </ScrollView>

          {myEntry ? (
            <View
              style={[
                styles.stickyBar,
                {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  paddingHorizontal: spacing(4),
                  paddingVertical: spacing(3),
                },
              ]}
            >
              <ThemedText variant="h2" style={{ color: colors.primary, width: spacing(8) }}>
                #{myRank}
              </ThemedText>
              <View
                style={[
                  styles.avatarCircleSmall,
                  { backgroundColor: colors.primarySurface, marginRight: spacing(3) },
                ]}
              >
                <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                  {getInitials(myEntry.fullName)}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {myEntry.fullName ?? 'Anda'}
                </ThemedText>
                <ThemedText variant="micro" color="secondary">
                  {myRank === 1
                    ? 'Peringkat teratas · pertahankan'
                    : (() => {
                        const above = filteredEntries[(myRank ?? 1) - 2];
                        const gap = above ? pointsForFilter(above, timeFilter) - pointsForFilter(myEntry, timeFilter) : 0;
                        return `${Math.max(gap, 0)} poin lagi untuk peringkat ${(myRank ?? 1) - 1}`;
                      })()}
                </ThemedText>
              </View>
              <ThemedText variant="h2">{pointsForFilter(myEntry, timeFilter)}</ThemedText>
            </View>
          ) : null}
        </>
      )}
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
    // 44x44: minimum platform (iOS HIG / Android). Dulu 36x36.
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {},
  timeChip: {
    borderWidth: 1,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestal: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rwChip: {
    borderRadius: 20,
    borderWidth: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
