import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getMyPointLedger,
  getProfileStats,
  listMySessions,
  revokeSession,
  type MySession,
  type PointLedgerEntry,
  type ProfileStats,
} from '@repo/supabase';
import { POINT_REASON_LABELS, urgencyColor, pointsColor } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useAuth, profileIsComplete } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { BottomNav } from './_components/BottomNav';
import { supabase } from './_components/supabase';
import { baseUrl } from './_components/api';
import { getAccessToken } from './_components/session';

interface WebGlobals {
  alert?: (message?: string) => void;
  confirm?: (message?: string) => boolean;
}

const webGlobals = globalThis as unknown as WebGlobals;

function showPlatformAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    webGlobals.alert?.(text);
  } else {
    Alert.alert(title, message);
  }
}

function confirmPlatformAction(
  title: string,
  message: string,
  action: () => void,
  confirmLabel = 'Lanjutkan',
  destructive = true,
) {
  if (Platform.OS === 'web') {
    const text = `${title}\n\n${message}`;
    if (webGlobals.confirm?.(text)) {
      action();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Batal', style: 'cancel' },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: action },
    ]);
  }
}

const POINT_HISTORY_LIMIT = 50;

/** Inisial dari dua kata pertama nama — sama pola dengan /leaderboard. */
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

function formatJoinedAt(joinedAt: string | null): string | null {
  if (!joinedAt) return null;
  return new Date(joinedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function formatLedgerDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Badge {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  ringColor: string;
  earned: boolean;
}

export default function ProfileScreen() {
  const { user, signOut, isLoading } = useAuth();
  const { colors, spacing, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (userId: string) => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const rows = await listMySessions(supabase, userId);
      setSessions(rows);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Gagal memuat daftar perangkat.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [profileStats, pointLedger] = await Promise.all([
        getProfileStats(supabase, userId),
        getMyPointLedger(supabase, userId),
      ]);
      setStats(profileStats);
      setLedger(pointLedger.slice(0, POINT_HISTORY_LIMIT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat profil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      load(user.id);
      loadSessions(user.id);
    }
  }, [load, loadSessions, user?.id]);

  const confirmSignOut = useCallback(() => {
    confirmPlatformAction('Keluar', 'Yakin ingin keluar dari akun?', () => signOut(), 'Keluar');
  }, [signOut]);

  const confirmSignOutAll = useCallback(() => {
    confirmPlatformAction(
      'Keluar dari semua perangkat',
      'Semua perangkat yang masuk akun ini akan dikeluarkan. Lanjutkan?',
      () => signOut(true),
      'Keluar semua',
    );
  }, [signOut]);

  const handleRevokeSession = useCallback(
    async (session: MySession) => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || !baseUrl) {
          showPlatformAlert('Gagal', 'Sesi tidak ditemukan.');
          return;
        }
        await revokeSession(baseUrl, accessToken, session.id);
        if (user?.id) loadSessions(user.id);
      } catch (err) {
        showPlatformAlert(
          'Gagal mencabut perangkat',
          err instanceof Error ? err.message : 'Terjadi kesalahan.',
        );
      }
    },
    [loadSessions, user?.id],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.centerFill, { paddingBottom: insets.bottom + spacing(16) }]}>
          <ThemedText color="secondary">Memuat profil…</ThemedText>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.centerFill, { paddingHorizontal: spacing(6), gap: spacing(3), paddingBottom: insets.bottom + spacing(16) }]}>
          <ThemedText variant="h2" align="center">
            Belum Masuk Akun
          </ThemedText>
          <ThemedText color="secondary" align="center">
            Silakan masuk ke akun SIGAP Anda untuk melihat profil, poin, dan lencana.
          </ThemedText>
          <Button
            text="Masuk ke Akun"
            onPress={() => router.push('/login')}
            containerStyle={{ width: '100%', maxWidth: 280 }}
          />
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const locationLabel = user.kelurahan && user.kecamatan
    ? `Kel. ${user.kelurahan} · Kec. ${user.kecamatan}`
    : null;
  const joinedLabel = formatJoinedAt(stats?.joinedAt ?? null);

  const badges: Badge[] = [
    {
      key: 'pelapor_awal',
      title: 'Pelapor Awal',
      subtitle: `${stats?.complaintCount ?? 0} aduan`,
      icon: 'megaphone-outline' as const,
      ringColor: colors.civicAmber,
      earned: (stats?.complaintCount ?? 0) >= 1,
    },
    {
      key: 'penjaga_kelurahan',
      title: `Penjaga ${user.kelurahan ?? 'Kelurahan'}`,
      subtitle: `${stats?.upvoteCount ?? 0} dukungan`,
      icon: 'shield-checkmark-outline' as const,
      ringColor: colors.primary,
      earned: (stats?.upvoteCount ?? 0) >= 1,
    },
    {
      key: 'suara_warga',
      title: 'Suara Warga',
      subtitle: `${stats?.aspirationCount ?? 0} aspirasi`,
      icon: 'chatbubbles-outline' as const,
      ringColor: colors.accent,
      earned: (stats?.aspirationCount ?? 0) >= 1,
    },
  ].sort((a, b) => Number(b.earned) - Number(a.earned));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <ThemedText variant="h2">Profil</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing(28) }}>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.primary, borderRadius: spacing(5), margin: spacing(4), padding: spacing(5) },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.accent, borderRadius: spacing(8) },
              ]}
            >
              <ThemedText variant="h1" style={{ color: colors.primary }}>
                {getInitials(user.fullName)}
              </ThemedText>
            </View>
            <View style={{ flex: 1, gap: spacing(0.5) }}>
              <ThemedText variant="h2" style={{ color: colors.surface }}>
                {user.fullName ?? 'Warga SIGAP'}
              </ThemedText>
              {locationLabel ? (
                <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {locationLabel}
                </ThemedText>
              ) : null}
              {joinedLabel ? (
                <ThemedText variant="micro" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Warga sejak {joinedLabel}
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push('/kartu-warga')}
              style={[
                styles.qrButton,
                { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: spacing(2.5) },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Kartu warga"
            >
              <Ionicons name="qr-code" size={20} color={colors.surface} />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={{ paddingHorizontal: spacing(4) }}>
            <ThemedText color="secondary">{error}</ThemedText>
            <Button
              text="Coba lagi"
              variant="secondary"
              onPress={() => user?.id && load(user.id)}
              containerStyle={{ alignSelf: 'center', marginTop: spacing(2) }}
            />
          </View>
        ) : loading ? (
          <ThemedText color="secondary" style={{ paddingHorizontal: spacing(4) }}>
            Memuat…
          </ThemedText>
        ) : (
          <>
            <View
              style={[
                styles.statsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: spacing(4),
                  marginHorizontal: spacing(6),
                  marginTop: -spacing(8),
                  padding: spacing(4),
                  gap: spacing(3),
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ gap: spacing(0.5) }}>
                  <ThemedText variant="micro" color="secondary">
                    Total poin
                  </ThemedText>
                  <ThemedText variant="h1" style={{ color: colors.civicAmber }}>
                    {stats?.totalPoints ?? 0}
                  </ThemedText>
                </View>
                <View style={{ gap: spacing(0.5), alignItems: 'flex-end' }}>
                  <ThemedText variant="micro" color="secondary">
                    Peringkat di {user.kelurahan ?? '—'}
                  </ThemedText>
                  <ThemedText variant="h1" style={{ color: colors.primary }}>
                    #{stats?.kelurahanRank ?? 0}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={{ flexDirection: 'row' }}>
                <View style={styles.statColumn}>
                  <ThemedText variant="h2">{stats?.complaintCount ?? 0}</ThemedText>
                  <ThemedText variant="micro" color="secondary">
                    Aduan
                  </ThemedText>
                </View>
                <View style={styles.statColumn}>
                  <ThemedText variant="h2">{stats?.aspirationCount ?? 0}</ThemedText>
                  <ThemedText variant="micro" color="secondary">
                    Aspirasi
                  </ThemedText>
                </View>
                <View style={styles.statColumn}>
                  <ThemedText variant="h2">{stats?.upvoteCount ?? 0}</ThemedText>
                  <ThemedText variant="micro" color="secondary">
                    Dukungan
                  </ThemedText>
                </View>
              </View>
            </View>


            {user && !profileIsComplete(user) ? (
              <View style={{ paddingHorizontal: spacing(6), marginTop: spacing(4) }}>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: spacing(3),
                    padding: spacing(4),
                    gap: spacing(2),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
                    <ThemedText variant="h2">Lengkapi profil Anda</ThemedText>
                  </View>
                  <ThemedText variant="body" color="secondary">
                    Isi nama, alamat, dan data wilayah untuk mengakses fitur warga.
                  </ThemedText>
                  <Button
                    text="Lengkapi profil"
                    variant="secondary"
                    onPress={() => router.push('/onboarding')}
                    containerStyle={{ marginTop: spacing(2) }}
                  />
                </View>
              </View>
            ) : null}
            <ThemedText
              variant="h2"
              style={{ paddingHorizontal: spacing(4), marginTop: spacing(6), marginBottom: spacing(3) }}
            >
              Lencana
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing(4), gap: spacing(3) }}
            >
              {badges.map((badge) => (
                <View
                  key={badge.key}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: spacing(4),
                      padding: spacing(3),
                      opacity: badge.earned ? 1 : 0.45,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeRing,
                      { borderColor: badge.ringColor, borderRadius: spacing(6) },
                    ]}
                  >
                    <Ionicons name={badge.icon} size={22} color={badge.ringColor} />
                  </View>
                  <ThemedText variant="caption" style={{ fontWeight: '700', textAlign: 'center' }}>
                    {badge.title}
                  </ThemedText>
                  <ThemedText variant="micro" color="secondary" align="center">
                    {badge.subtitle}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>

            <View
              style={[
                styles.sectionHeader,
                { paddingHorizontal: spacing(4), marginTop: spacing(6), marginBottom: spacing(3) },
              ]}
            >
              <ThemedText variant="h2">Riwayat poin</ThemedText>
              {/* Tautan "Lihat semua" DULU tidak menuju ke mana pun sementara
                  daftarnya dipotong ke POINT_HISTORY_LIMIT, jadi warga tidak
                  punya jalan sama sekali untuk mengaudit poinnya sendiri —
                  padahal ledger yang bisa diaudit itu justru alasan tabelnya
                  ada. Sampai layar riwayat penuh dibuat, batasnya dinaikkan
                  dan tautan buntu ini dihapus. */}
              <ThemedText variant="caption" color="secondary">
                {ledger.length} entri terakhir
              </ThemedText>
            </View>

            {ledger.length === 0 ? (
              <ThemedText color="secondary" style={{ paddingHorizontal: spacing(4) }}>
                Belum ada riwayat poin.
              </ThemedText>
            ) : (
              <View style={{ paddingHorizontal: spacing(4), gap: spacing(2) }}>
                {ledger.map((entry) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.ledgerRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: spacing(3),
                        padding: spacing(3),
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: spacing(0.5) }}>
                      <ThemedText variant="body" style={{ fontWeight: '600' }}>
                        {POINT_REASON_LABELS[entry.reason as keyof typeof POINT_REASON_LABELS] ?? entry.reason}
                      </ThemedText>
                      <ThemedText variant="micro" color="secondary">
                        {formatLedgerDate(entry.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText
                      variant="body"
                      style={{
                        color: pointsColor(entry.points, mode).fg,
                        fontWeight: '700',
                      }}
                    >
                      {entry.points >= 0 ? `+${entry.points}` : entry.points}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            <ThemedText
              variant="micro"
              color="secondary"
              style={{ paddingHorizontal: spacing(4), marginTop: spacing(3) }}
            >
              Poin dihitung dari seluruh baris ledger. Baris negatif muncul bila laporan terbukti palsu.
            </ThemedText>

            <View
              style={[
                styles.sectionHeader,
                {
                  paddingHorizontal: spacing(4),
                  marginTop: spacing(6),
                  marginBottom: spacing(3),
                },
              ]}
            >
              <ThemedText variant="h2">Perangkat Aktif</ThemedText>
              <ThemedText variant="caption" color="secondary">
                {sessions.length} aktif
              </ThemedText>
            </View>

            {sessionsError ? (
              <View style={{ paddingHorizontal: spacing(4) }}>
                <ThemedText color="danger">{sessionsError}</ThemedText>
                <Button
                  text="Coba lagi"
                  variant="secondary"
                  onPress={() => user?.id && loadSessions(user.id)}
                  containerStyle={{ alignSelf: 'center', marginTop: spacing(2) }}
                />
              </View>
            ) : sessionsLoading ? (
              <ThemedText color="secondary" style={{ paddingHorizontal: spacing(4) }}>
                Memuat perangkat…
              </ThemedText>
            ) : sessions.length === 0 ? (
              <ThemedText color="secondary" style={{ paddingHorizontal: spacing(4) }}>
                Tidak ada perangkat aktif.
              </ThemedText>
            ) : (
              <View style={{ paddingHorizontal: spacing(4), gap: spacing(2) }}>
                {sessions.map((session) => (
                  <View
                    key={session.id}
                    style={[
                      styles.sessionRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: spacing(3),
                        padding: spacing(3),
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3), flex: 1 }}>
                      <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
                      <View style={{ flex: 1, gap: spacing(0.5) }}>
                        <ThemedText variant="body" style={{ fontWeight: '600' }}>
                          {session.deviceLabel ?? 'Perangkat tidak dikenal'}
                        </ThemedText>
                        <ThemedText variant="micro" color="secondary">
                          Aktif sejak {formatSessionDate(session.createdAt)} · terakhir{' '}
                          {formatSessionDate(session.lastUsedAt)}
                        </ThemedText>
                      </View>
                    </View>
                    <Pressable
                      onPress={() =>
                        confirmPlatformAction(
                          'Cabut sesi',
                          'Cabut akses perangkat ini?',
                          () => handleRevokeSession(session),
                          'Cabut',
                        )
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Cabut perangkat"
                    >
                      <Ionicons name="close-circle-outline" size={24} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Pressable
          onPress={confirmSignOutAll}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              borderColor: colors.danger,
              borderRadius: spacing(3),
              marginHorizontal: spacing(4),
              marginTop: spacing(6),
              backgroundColor: pressed ? colors.dangerSurface : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Keluar dari semua perangkat"
        >
          <Ionicons name="phone-portrait-outline" size={20} color={colors.danger} />
          <ThemedText variant="h2" color="danger">
            Keluar dari semua perangkat
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              borderColor: colors.civicAmber,
              borderRadius: spacing(3),
              marginHorizontal: spacing(4),
              marginTop: spacing(4),
              marginBottom: spacing(2),
              backgroundColor: pressed ? colors.background : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Keluar"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.civicAmber} />
          <ThemedText variant="h2" color="danger">
            Keluar
          </ThemedText>
        </Pressable>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    borderWidth: 1,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeCard: {
    width: 112,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  badgeRing: {
    width: 48,
    height: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 14,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
});
