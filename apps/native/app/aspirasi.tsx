import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  listAspirations,
  listAspirationsByKecamatan,
  getActiveVotingPeriod,
  listMyVotedAspirationIds,
  voteAspiration,
  isDuplicateVoteError,
  isVoteDeniedError,
  type AspirationSummary,
  type VotingPeriod,
} from '@repo/supabase';
import { DUMMY_VOTING_PERIOD, DUMMY_ASPIRATIONS } from './_components/dummyAspirations';
import { formatSlaCountdown } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { AspirationCard } from './_components/AspirationCard';
import { BottomNav } from './_components/BottomNav';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

type Tab = 'kelurahan' | 'musrenbang';

export default function AspirasiScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('kelurahan');
  const [period, setPeriod] = useState<VotingPeriod | null>(null);
  const [kelurahanList, setKelurahanList] = useState<AspirationSummary[]>([]);
  const [kecamatanList, setKecamatanList] = useState<AspirationSummary[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voteDeltas, setVoteDeltas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activePeriod, byKelurahan, byKecamatan, mine] = await Promise.all([
        getActiveVotingPeriod(supabase),
        user?.kelurahan ? listAspirations(supabase, user.kelurahan) : Promise.resolve([]),
        user?.kecamatan ? listAspirationsByKecamatan(supabase, user.kecamatan) : Promise.resolve([]),
        user ? listMyVotedAspirationIds(supabase, user.id) : Promise.resolve(new Set<string>()),
      ]);
      setPeriod(activePeriod);
      setKelurahanList(byKelurahan);
      setKecamatanList(byKecamatan);
      setVotedIds(mine);
    } catch (e) {
      console.error('load aspirasi error', e);
      setError('Gagal memuat aspirasi. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = useCallback(
    async (aspiration: AspirationSummary) => {
      if (!user || votedIds.has(aspiration.id)) return;
      setVotedIds((prev) => new Set(prev).add(aspiration.id));
      setVoteDeltas((prev) => ({ ...prev, [aspiration.id]: (prev[aspiration.id] ?? 0) + 1 }));
      if (aspiration.id.startsWith('dummy-')) return;
      try {
        await voteAspiration(supabase, aspiration.id, user.id);
      } catch (e) {
        if (isDuplicateVoteError(e)) return;
        console.error('voteAspiration error', e);
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(aspiration.id);
          return next;
        });
        setVoteDeltas((prev) => ({ ...prev, [aspiration.id]: (prev[aspiration.id] ?? 0) - 1 }));
        const message = isVoteDeniedError(e)
          ? 'Anda hanya bisa mendukung aspirasi di kelurahan sendiri saat periode voting aktif.'
          : 'Tidak bisa mendukung aspirasi ini sekarang. Coba lagi.';
        Alert.alert('Gagal', message);
      }
    },
    [user, votedIds]
  );

  /**
   * Periode voting contoh HANYA di build pengembangan.
   *
   * Dulu `period ?? DUMMY_VOTING_PERIOD` membuat spanduk tetap berbunyi
   * "<nama> terbuka" lengkap dengan hitung mundur meski tidak ada periode
   * yang benar-benar dibuka. Warga ikut memilih, RLS `votes_insert_own`
   * menolaknya karena `vp.is_active` tidak terpenuhi, dan pesan galat yang
   * muncul menyalahkan hal yang salah ("hanya bisa mendukung aspirasi di
   * kelurahan sendiri saat periode voting aktif").
   */
  const displayedPeriod = period ?? (__DEV__ ? DUMMY_VOTING_PERIOD : null);

  const kelurahanItems = useMemo(
    () =>
      [
        ...kelurahanList,
        ...(__DEV__ ? DUMMY_ASPIRATIONS.filter((a) => a.kelurahan === user?.kelurahan) : []),
      ].sort((a, b) => b.voteCount - a.voteCount),
    [kelurahanList, user?.kelurahan]
  );
  const kecamatanItems = useMemo(
    () =>
      [
        ...kecamatanList,
        ...(__DEV__ ? DUMMY_ASPIRATIONS.filter((a) => a.kecamatan === user?.kecamatan) : []),
      ].sort((a, b) => b.voteCount - a.voteCount),
    [kecamatanList, user?.kecamatan]
  );

  const activeList = tab === 'kelurahan' ? kelurahanItems : kecamatanItems;

  const hasRegion = tab === 'kelurahan' ? !!user?.kelurahan : !!user?.kecamatan;
  const subtitle =
    tab === 'kelurahan'
      ? `Usulan di Kel. ${user?.kelurahan ?? '-'}, terurut suara`
      : `Usulan di Kec. ${user?.kecamatan ?? '-'}, terurut suara`;
  // `formatSlaCountdown` mengembalikan "Lewat batas SLA" untuk selisih
  // negatif — kalimat SLA aduan yang tidak ada hubungannya dengan voting.
  const msLeft = displayedPeriod ? new Date(displayedPeriod.endsAt).getTime() - Date.now() : 0;
  const remaining = !displayedPeriod
    ? null
    : msLeft <= 0
      ? 'sudah ditutup'
      : formatSlaCountdown(msLeft).replace(' lagi', '');
  const closesOn = displayedPeriod
    ? new Date(displayedPeriod.endsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <ThemedText variant="h2">Aspirasi</ThemedText>
      </View>

      {error ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">{error}</ThemedText>
          <Pressable onPress={load} style={{ marginTop: spacing(3) }}>
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>Coba lagi</ThemedText>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat aspirasi…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={activeList}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(24), gap: spacing(3) }}
          ListHeaderComponent={
            <View style={{ gap: spacing(3), marginBottom: spacing(3) }}>
              <ThemedText variant="h1">Aspirasi warga</ThemedText>

              <View
                style={[
                  styles.banner,
                  { backgroundColor: colors.primarySurface, borderRadius: spacing(3), padding: spacing(3), gap: spacing(1) },
                ]}
              >
                <View style={[styles.bannerTitleRow, { gap: spacing(2) }]}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <ThemedText variant="body" style={{ color: colors.primary, fontWeight: '700', flex: 1 }}>
                    {displayedPeriod ? `${displayedPeriod.name} terbuka` : 'Belum ada periode voting'}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" style={{ color: colors.primary, opacity: 0.85 }}>
                  {displayedPeriod
                    ? `Tutup ${closesOn} · ${remaining}`
                    : 'Usulan tetap bisa dikirim; dukungan dibuka saat kelurahan membuka periode voting berikutnya.'}
                </ThemedText>
              </View>

              <View style={[styles.tabRow, { gap: spacing(2) }]}>
                <Pressable
                  onPress={() => setTab('kelurahan')}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: tab === 'kelurahan' ? colors.primary : colors.surface,
                      borderRadius: spacing(6),
                      paddingHorizontal: spacing(4),
                      paddingVertical: spacing(2),
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    style={{ color: tab === 'kelurahan' ? colors.surface : colors.textPrimary, fontWeight: '700' }}
                  >
                    Kelurahan saya
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setTab('musrenbang')}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: tab === 'musrenbang' ? colors.primary : colors.surface,
                      borderRadius: spacing(6),
                      paddingHorizontal: spacing(4),
                      paddingVertical: spacing(2),
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    style={{ color: tab === 'musrenbang' ? colors.surface : colors.textPrimary, fontWeight: '700' }}
                  >
                    Musrenbang
                  </ThemedText>
                </Pressable>
              </View>

              {hasRegion ? (
                <ThemedText variant="caption" color="secondary">
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !hasRegion ? (
              <View style={[styles.center, { paddingVertical: spacing(8) }]}>
                <ThemedText color="secondary">
                  {tab === 'kelurahan'
                    ? 'Lengkapi kelurahan pada profil Anda untuk melihat aspirasi wilayah.'
                    : 'Lengkapi kecamatan pada profil Anda untuk melihat aspirasi Musrenbang.'}
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.center, { paddingVertical: spacing(8) }]}>
                <ThemedText color="secondary">Belum ada aspirasi untuk ditampilkan.</ThemedText>
              </View>
            )
          }
          renderItem={({ item, index }) => {
            const delta = voteDeltas[item.id] ?? 0;
            const displayItem = delta ? { ...item, voteCount: item.voteCount + delta } : item;
            return (
              <AspirationCard
                aspiration={displayItem}
                rank={index + 1}
                hasVoted={votedIds.has(item.id)}
                onPress={() => router.push(`/aspirasi/${item.id}`)}
                onVote={() => handleVote(item)}
              />
            );
          }}
        />
      )}

      <Pressable
        onPress={() => router.push('/aspirasi/new')}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            borderRadius: spacing(6),
            paddingHorizontal: spacing(4),
            paddingVertical: spacing(3),
            gap: spacing(1),
            shadowColor: colors.textPrimary,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Usulkan aspirasi baru"
      >
        <Ionicons name="add" size={18} color={colors.surface} />
        <ThemedText variant="caption" style={{ color: colors.surface, fontWeight: '700' }}>
          Usulkan
        </ThemedText>
      </Pressable>

      <BottomNav />
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {},
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
