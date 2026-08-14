import { useMemo } from 'react';
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

import { getMyComplaintSummary, type ComplaintSummary } from '@repo/supabase';
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

  useEffect(() => {
    if (user) {
      getMyComplaintSummary(supabase, user.id).then(setSummary);
    }
  }, [supabase, user]);

  const reportData = summary ?? {
    in_progress: 0,
    resolved: 0,
    pending: 0,
    latest: null,
  };

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
  const p0 = useMemo(() => urgencyColor('P0', mode), [mode]);

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
              <ThemedText variant="body" style={{ color: colors.accent }}>
                Selamat pagi,
              </ThemedText>
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
                    {reportData[key as keyof typeof COUNT_LABELS]}
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
              onPress={() => reportData.latest && router.push(`/aduan/${reportData.latest.id}`)}
              style={({ pressed }) => [
                styles.latestRow,
                {
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={reportData.latest?.title ?? 'Lihat aduan terbaru'}
            >
              <View
                style={[
                  styles.urgencyPill,
                  { backgroundColor: p1.bg },
                ]}
              >
                <ThemedText
                  variant="micro"
                  style={{
                    color: p1.fg,
                    fontWeight: '700',
                  }}
                >
                  P1 Penting
                </ThemedText>
              </View>
              <ThemedText
                variant="caption"
                color="secondary"
                style={{
                  flex: 1,
                  marginHorizontal: spacing(3),
                }}
                numberOfLines={1}
              >
                {reportData.latest?.title ?? 'Belum ada laporan'}
              </ThemedText>
              <ThemedText
                variant="micro"
                style={{ color: p1.fg }}
              >
                {reportData.latest?.time ?? '-'}
              </ThemedText>
            </Pressable>
          </View>

          {/* Pengumuman */}
          <Pressable
            onPress={() => router.push('/pengumuman')}
            style={({ pressed }) => [
              styles.announcementCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderLeftColor: colors.civicAmber,
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
                Pengumuman disematkan
              </ThemedText>
              <ThemedText
                variant="h2"
                style={{ marginTop: spacing(1) }}
              >
                Musrenbang kelurahan Dago dibuka sampai 24 Agustus
              </ThemedText>
              <ThemedText
                variant="caption"
                color="secondary"
                style={{ marginTop: spacing(2) }}
              >
                Usulan warga yang lolos masuk ke pembahasan APBD 2027.
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
                <ThemedText variant="h2">Peringkat Dago</ThemedText>
                <View
                  style={[
                    styles.pointsPill,
                    { backgroundColor: p1.bg },
                  ]}
                >
                  <View
                    style={[
                      styles.pointsDot,
                      { backgroundColor: colors.civicAmber },
                    ]}
                  />
                  <ThemedText
                    variant="micro"
                    style={{
                      color: colors.civicAmber,
                      fontWeight: '600',
                      marginLeft: spacing(1),
                    }}
                  >
                    1.248 poin
                  </ThemedText>
                </View>
              </View>
              <View style={styles.rankRow}>
                <ThemedText
                  variant="display"
                  style={{
                    color: colors.primary,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  #4
                </ThemedText>
                <ThemedText
                  variant="caption"
                  color="secondary"
                  style={{ marginLeft: spacing(2) }}
                >
                  dari 30 kelurahan · naik 2 peringkat pekan ini
                </ThemedText>
              </View>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.primarySurface },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: '78%', backgroundColor: colors.accent },
                  ]}
                />
              </View>
              <ThemedText
                variant="caption"
                color="secondary"
                style={{ marginTop: spacing(3) }}
              >
                78% aduan Dago selesai dalam SLA.
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating SOS */}
      <Pressable
        onPress={() => router.push('/sos')}
        style={({ pressed }) => [
          styles.sosButton,
          {
            backgroundColor: p0.fg,
            bottom: insets.bottom + spacing(22),
            opacity: pressed ? 0.9 : 1,
            shadowColor: p0.fg,
            shadowOpacity: 0.36,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="SOS Darurat"
      >
        <Ionicons name="warning" size={24} color={colors.surface} />
        <ThemedText
          variant="micro"
          style={{
            color: colors.surface,
            marginTop: spacing(1),
            fontWeight: '800',
            letterSpacing: 0.6,
          }}
        >
          SOS
        </ThemedText>
      </Pressable>

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
    borderLeftWidth: 4,
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
  sosButton: {
    position: 'absolute',
    right: 20,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
});
