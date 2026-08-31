import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { statusColor, urgencyColor } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { BottomNav } from './_components/BottomNav';

import {
  getMyComplaintSummary,
  listAnnouncements,
  listLeaderboard,
  type Announcement,
  type ComplaintSummary,
  type KelurahanLeaderboardEntry,
} from '@repo/supabase';
import { useEffect, useState } from 'react';
import { supabase } from './_components/supabase';

const COUNT_LABELS: Record<'in_progress' | 'resolved' | 'pending', string> = {
  in_progress: 'Diproses',
  resolved: 'Selesai',
  pending: 'Menunggu',
};

type ShortcutScheme = 'primary' | 'accent' | 'urgency' | 'amber';
type IconName = ComponentProps<typeof Ionicons>['name'];

const SHORTCUTS: {
  title: string;
  subtitle: string;
  route: `/${string}`;
  icon: IconName;
  scheme: ShortcutScheme;
}[] = [
  {
    title: 'Aspirasi',
    subtitle: 'Usulan & Musrenbang',
    route: '/aspirasi',
    icon: 'chatbubbles',
    scheme: 'primary',
  },
  {
    title: 'Anggaran',
    subtitle: 'APBD & tanya AI',
    route: '/anggaran',
    icon: 'wallet',
    scheme: 'accent',
  },
  {
    title: 'Layanan',
    subtitle: 'Surat & dokumen',
    route: '/layanan',
    icon: 'document-text',
    scheme: 'primary',
  },
  {
    title: 'Darurat',
    subtitle: 'Kirim SOS',
    route: '/sos',
    icon: 'warning',
    scheme: 'urgency',
  },
  {
    title: 'Pengumuman',
    subtitle: 'Kabar kelurahan',
    route: '/pengumuman',
    icon: 'megaphone',
    scheme: 'amber',
  },
  {
    title: 'Leaderboard',
    subtitle: 'Poin & lencana',
    route: '/leaderboard',
    icon: 'trophy',
    scheme: 'amber',
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ComplaintSummary | null>(null);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<Announcement | null>(null);
  const [kelurahanRank, setKelurahanRank] = useState<{
    rank: number;
    total: number;
    entry: KelurahanLeaderboardEntry;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    setLoading(true);
    try {
      // Dulu hanya `getMyComplaintSummary(...).then(setSummary)` — tanpa
      // `.catch` dan tanpa keadaan memuat. Penolakan promise-nya tidak
      // tertangani, dan sementara itu (juga selamanya, kalau gagal) kartu
      // beranda menyatakan "0 diproses · 0 selesai · 0 menunggu" kepada
      // warga yang punya lima laporan terbuka.
      const [s, announcements, leaderboard] = await Promise.all([
        getMyComplaintSummary(supabase, user.id),
        listAnnouncements(supabase, user.kelurahan ?? null, user.id),
        listLeaderboard(supabase),
      ]);
      setSummary(s);
      setPinnedAnnouncement(announcements.find((a) => a.isPinned) ?? announcements[0] ?? null);

      const index = leaderboard.findIndex((e) => e.kelurahan === user.kelurahan);
      setKelurahanRank(
        index >= 0 && leaderboard[index]
          ? { rank: index + 1, total: leaderboard.length, entry: leaderboard[index] }
          : null,
      );
    } catch (e) {
      console.error('load home error', e);
      setLoadError('Koneksi sedang terganggu. Tarik ke bawah atau coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const reportData = summary;

  const { colors, spacing, mode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const iconPalette = useMemo(
    () => ({
      primary: {
        bg: colors.primarySurface,
        icon: colors.primary,
      },
      accent: {
        bg: colors.accentSurface,
        icon: colors.accent,
      },
      urgency: {
        bg: urgencyColor('P0', mode).bg,
        icon: urgencyColor('P0', mode).fg,
      },
      amber: {
        bg: urgencyColor('P1', mode).bg,
        icon: colors.civicAmber,
      },
    }),
    [colors, mode],
  );

  const p1 = useMemo(() => urgencyColor('P1', mode), [mode]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing(32),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.primary,
              paddingTop: insets.top + spacing(5),
              paddingBottom: spacing(7),
              borderBottomLeftRadius: spacing(5),
              borderBottomRightRadius: spacing(5),
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.greeting}>
              <ThemedText
                variant="display"
                style={{ color: colors.surface, marginTop: spacing(1) }}
              >
                {user?.fullName ?? 'Warga'}
              </ThemedText>
              <View
                style={[
                  styles.locationPill,
                  { backgroundColor: colors.primaryPressed },
                ]}
              >
                <View
                  style={[
                    styles.locationDot,
                    { backgroundColor: colors.accent },
                  ]}
                />
                <ThemedText variant="micro" style={{ color: colors.surface }}>
                  Kel. {user?.kelurahan ?? 'Dago'} · Kec.{' '}
                  {user?.kecamatan ?? 'Coblong'}
                </ThemedText>
              </View>
            </View>

          </View>
        </View>

        <View style={styles.contentPadding}>
          {/* Laporan Anda */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginTop: -spacing(4),
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <ThemedText variant="h2">Laporan Anda</ThemedText>
              <Pressable
                onPress={() => router.push('/feed')}
                accessibilityRole="button"
                accessibilityLabel="Lihat semua laporan"
              >
                <ThemedText
                  variant="micro"
                  style={{
                    color: colors.primary,
                    fontWeight: '600',
                  }}
                >
                  Lihat semua
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.statusGrid}>
              {(
                [
                  'in_progress',
                  'resolved',
                  'pending',
                ] as const
              ).map((key) => {
                const pair = statusColor(key, mode);
                return (
                  <View
                    key={key}
                    style={[
                      styles.statusBox,
                      { backgroundColor: pair.bg },
                    ]}
                  >
                    <ThemedText
                      variant="h1"
                      style={{
                        color: pair.fg,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {/* "—" selama memuat/gagal, bukan "0": nol adalah
                          pernyataan bahwa warga tidak punya laporan. */}
                      {reportData ? reportData[key as keyof typeof COUNT_LABELS] : '—'}
                    </ThemedText>
                    <ThemedText
                      variant="micro"
                      style={{
                        color: pair.fg,
                        marginTop: spacing(1),
                      }}
                    >
                      {COUNT_LABELS[key]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <Pressable
              onPress={() => reportData?.latest && router.push(`/aduan/${reportData.latest.id}`)}
              disabled={!reportData?.latest}
              style={({ pressed }) => [
                styles.latestRow,
                {
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={reportData?.latest?.title ?? 'Belum ada laporan'}
            >
              {/* Pil urgensi DULU dipatok "P1 Penting" untuk aduan apa pun,
                  dan tetap dirender di samping "Belum ada laporan". */}
              {reportData?.latest ? (
                <View style={[styles.urgencyPill, { backgroundColor: p1.bg }]}>
                  <ThemedText variant="micro" style={{ color: p1.fg, fontWeight: '700' }}>
                    Terbaru
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText
                variant="caption"
                color="secondary"
                style={{
                  flex: 1,
                  marginHorizontal: spacing(3),
                }}
                numberOfLines={1}
              >
                {loading ? 'Memuat…' : reportData?.latest?.title ?? 'Belum ada laporan'}
              </ThemedText>
              <ThemedText
                variant="micro"
                style={{ color: p1.fg }}
              >
                {reportData?.latest?.time ?? ''}
              </ThemedText>
            </Pressable>
          </View>

          {/* Pengumuman */}
          <Pressable
            onPress={() => router.push('/pengumuman')}
            style={({ pressed }) => [
              styles.announcementCard,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.95 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pengumuman disematkan"
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: p1.bg },
              ]}
            >
              <Ionicons
                name="megaphone"
                size={18}
                color={colors.civicAmber}
              />
            </View>
            <View style={styles.announcementBody}>
              <ThemedText
                variant="micro"
                style={{ color: colors.civicAmber }}
              >
                {pinnedAnnouncement?.isPinned ? 'Pengumuman disematkan' : 'Pengumuman terbaru'}
              </ThemedText>
              <ThemedText
                variant="h2"
                style={{ marginTop: spacing(1) }}
              >
                {/* Kartu ini DULU berisi teks tetap ("Musrenbang kelurahan
                    Dago dibuka sampai 24 Agustus") yang tidak didukung query
                    apa pun: setiap warga di setiap kelurahan melihat
                    pengumuman karangan yang sama. */}
                {pinnedAnnouncement?.title ?? 'Belum ada pengumuman'}
              </ThemedText>
              <ThemedText
                variant="caption"
                color="secondary"
                style={{ marginTop: spacing(2) }}
                numberOfLines={2}
              >
                {pinnedAnnouncement?.body ?? 'Kabar dari kelurahan akan muncul di sini.'}
              </ThemedText>
            </View>
          </Pressable>

          {/* Layanan lain */}
          <View style={styles.section}>
            <ThemedText variant="h2">Layanan lain</ThemedText>
            <View style={styles.shortcutsGrid}>
              {SHORTCUTS.map((item) => {
                const palette = iconPalette[item.scheme];
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => router.push(item.route)}
                    style={({ pressed }) => [
                      styles.shortcut,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View
                      style={[
                        styles.shortcutIcon,
                        { backgroundColor: palette.bg },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={palette.icon}
                      />
                    </View>
                    <ThemedText variant="h2">{item.title}</ThemedText>
                    <ThemedText variant="caption" color="secondary">
                      {item.subtitle}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Leaderboard */}
          <View style={styles.section}>
            <View
              style={[
                styles.leaderboardCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.leaderboardHeader}>
                <ThemedText variant="h2">
                  {user?.kelurahan ? `Peringkat ${user.kelurahan}` : 'Peringkat kelurahan'}
                </ThemedText>
                <View style={[styles.pointsPill, { backgroundColor: p1.bg }]}>
                  <View style={[styles.pointsDot, { backgroundColor: colors.civicAmber }]} />
                  <ThemedText
                    variant="micro"
                    style={{ color: colors.civicAmber, fontWeight: '600', marginLeft: spacing(1) }}
                  >
                    {/* Seluruh kartu ini DULU dipatok: "1.248 poin", "#4",
                        "dari 30 kelurahan · naik 2 peringkat pekan ini", bilah
                        78%, dan "78% aduan Dago selesai dalam SLA" — statistik
                        kinerja pemerintah karangan yang ditampilkan kepada
                        setiap warga. Sekarang seluruhnya berasal dari
                        `kelurahan_leaderboard`. */}
                    {kelurahanRank
                      ? `${kelurahanRank.entry.totalPoints.toLocaleString('id-ID')} poin`
                      : '— poin'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.rankRow}>
                <ThemedText
                  variant="display"
                  style={{ color: colors.primary, fontVariant: ['tabular-nums'] }}
                >
                  {kelurahanRank ? `#${kelurahanRank.rank}` : '—'}
                </ThemedText>
                <ThemedText variant="caption" color="secondary" style={{ marginLeft: spacing(2) }}>
                  {kelurahanRank
                    ? `dari ${kelurahanRank.total} kelurahan`
                    : loading
                      ? 'Memuat peringkat…'
                      : 'Peringkat belum tersedia untuk kelurahan Anda.'}
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.primarySurface }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: kelurahanRank && kelurahanRank.entry.reportCount > 0
                        ? `${Math.round((kelurahanRank.entry.resolvedCount / kelurahanRank.entry.reportCount) * 100)}%`
                        : '0%',
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              </View>
              <ThemedText variant="caption" color="secondary" style={{ marginTop: spacing(3) }}>
                {kelurahanRank && kelurahanRank.entry.reportCount > 0
                  ? `${Math.round((kelurahanRank.entry.resolvedCount / kelurahanRank.entry.reportCount) * 100)}% aduan ${kelurahanRank.entry.kelurahan} sudah selesai ditangani.`
                  : 'Belum ada aduan yang bisa dihitung untuk kelurahan ini.'}
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  greeting: {
    flex: 1,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statusBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  urgencyPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  announcementCard: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementBody: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  shortcut: {
    flex: 1,
    minWidth: '46%',
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    gap: 8,
  },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  pointsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
