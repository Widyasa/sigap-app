import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  listAspirations,
  listMyVotedAspirationIds,
  voteAspiration,
  getActiveVotingPeriod,
  isDuplicateVoteError,
  isVoteDeniedError,
  type AspirationSummary,
  type VotingPeriod,
} from '@repo/supabase';
import { canVoteAspiration } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { AspirationCard } from './_components/AspirationCard';
import { VotingCountdown } from './_components/VotingCountdown';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

export default function AspirasiScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [period, setPeriod] = useState<VotingPeriod | null>(null);
  const [aspirations, setAspirations] = useState<AspirationSummary[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [activePeriod, list, mine] = await Promise.all([
        getActiveVotingPeriod(supabase),
        user?.kelurahan ? listAspirations(supabase, user.kelurahan) : Promise.resolve([]),
        user ? listMyVotedAspirationIds(supabase, user.id) : Promise.resolve(new Set<string>()),
      ]);
      setPeriod(activePeriod);
      setAspirations(list);
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
      setAspirations((prev) =>
        prev.map((a) => (a.id === aspiration.id ? { ...a, voteCount: a.voteCount + 1 } : a)),
      );
      try {
        await voteAspiration(supabase, aspiration.id, user.id);
      } catch (e) {
        if (isDuplicateVoteError(e)) return; // sudah dipilih sebelumnya, state sudah benar
        console.error('voteAspiration error', e);
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(aspiration.id);
          return next;
        });
        setAspirations((prev) =>
          prev.map((a) => (a.id === aspiration.id ? { ...a, voteCount: a.voteCount - 1 } : a)),
        );
        const message = isVoteDeniedError(e)
          ? 'Anda hanya bisa memilih aspirasi di kelurahan sendiri saat periode voting aktif.'
          : 'Tidak bisa memilih aspirasi ini sekarang. Coba lagi.';
        Alert.alert('Gagal', message);
      }
    },
    [user, votedIds],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { padding: spacing(4), gap: spacing(3) }]}>
        <ThemedText variant="h1">Aspirasi Warga</ThemedText>
        {period ? (
          <VotingCountdown periodName={period.name} endsAt={period.endsAt} />
        ) : (
          <ThemedText variant="caption" color="secondary">
            Belum ada periode voting yang sedang berjalan.
          </ThemedText>
        )}
        <Button
          text="Usulkan Aspirasi"
          onPress={() => router.push('/aspirasi/new')}
        />
      </View>

      {error ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">{error}</ThemedText>
          <Button text="Coba Lagi" variant="secondary" onPress={load} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat aspirasi…</ThemedText>
        </View>
      ) : !user?.kelurahan ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">
            Lengkapi kelurahan pada profil Anda untuk melihat aspirasi wilayah.
          </ThemedText>
        </View>
      ) : aspirations.length === 0 ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Belum ada aspirasi di kelurahan Anda.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={aspirations}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
          renderItem={({ item }) => {
            const canVote = canVoteAspiration(user?.kelurahan ?? null, item, period);
            return (
              <AspirationCard
                aspiration={item}
                hasVoted={votedIds.has(item.id)}
                canVote={canVote}
                voteDisabledReason={
                  !canVote
                    ? 'Voting hanya berlaku untuk aspirasi di kelurahan Anda selama periode voting aktif.'
                    : undefined
                }
                onPress={() => router.push(`/aspirasi/${item.id}`)}
                onVote={() => handleVote(item)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
