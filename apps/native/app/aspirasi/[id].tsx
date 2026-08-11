import { useCallback, useEffect, useState } from 'react';
import { Image, View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAspirationDetail,
  listMyVotedAspirationIds,
  getActiveVotingPeriod,
  voteAspiration,
  isDuplicateVoteError,
  isVoteDeniedError,
  type AspirationDetail,
  type VotingPeriod,
} from '@repo/supabase';
import { canVoteAspiration, formatRupiah } from '@repo/shared';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { AspirationStatusBadge } from '../_components/Badge';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

export default function AspirationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [aspiration, setAspiration] = useState<AspirationDetail | null>(null);
  const [period, setPeriod] = useState<VotingPeriod | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [detail, activePeriod, mine] = await Promise.all([
        getAspirationDetail(supabase, id),
        getActiveVotingPeriod(supabase),
        user ? listMyVotedAspirationIds(supabase, user.id) : Promise.resolve(new Set<string>()),
      ]);
      setAspiration(detail);
      setPeriod(activePeriod);
      setHasVoted(mine.has(id));
    } catch (e) {
      console.error('load aspiration detail error', e);
      setError('Gagal memuat detail aspirasi.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = useCallback(async () => {
    if (!user || !aspiration || hasVoted) return;
    setHasVoted(true);
    setAspiration((prev) => (prev ? { ...prev, voteCount: prev.voteCount + 1 } : prev));
    try {
      await voteAspiration(supabase, aspiration.id, user.id);
    } catch (e) {
      if (isDuplicateVoteError(e)) return;
      console.error('voteAspiration error', e);
      setHasVoted(false);
      setAspiration((prev) => (prev ? { ...prev, voteCount: prev.voteCount - 1 } : prev));
      const message = isVoteDeniedError(e)
        ? 'Anda hanya bisa memilih aspirasi di kelurahan sendiri saat periode voting aktif.'
        : 'Tidak bisa memilih aspirasi ini sekarang. Coba lagi.';
      Alert.alert('Gagal', message);
    }
  }, [user, aspiration, hasVoted]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !aspiration) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">{error ?? 'Aspirasi tidak ditemukan.'}</ThemedText>
          <Button text="Kembali" variant="secondary" onPress={() => router.back()} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      </SafeAreaView>
    );
  }

  const canVote = canVoteAspiration(user?.kelurahan ?? null, aspiration, period);
  const budgetItem = aspiration.budgetItem;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
        <Button text="< Kembali" variant="ghost" onPress={() => router.back()} containerStyle={styles.backButton} />

        <View style={{ gap: spacing(2) }}>
          <ThemedText variant="h1">{aspiration.title}</ThemedText>
          <AspirationStatusBadge status={aspiration.status} />
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Deskripsi</ThemedText>
          <ThemedText color="secondary">{aspiration.description}</ThemedText>
        </View>

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h2">Lokasi</ThemedText>
          <ThemedText color="secondary">
            {aspiration.kelurahan}, {aspiration.kecamatan}
          </ThemedText>
        </View>

        {aspiration.category || aspiration.estimatedBeneficiaries || aspiration.estimatedCost ? (
          <View style={{ gap: spacing(1) }}>
            <ThemedText variant="h2">Detail Usulan</ThemedText>
            {aspiration.category ? (
              <ThemedText color="secondary">Kategori: {aspiration.category}</ThemedText>
            ) : null}
            {aspiration.estimatedBeneficiaries ? (
              <ThemedText color="secondary">
                Perkiraan warga terdampak: {aspiration.estimatedBeneficiaries}
              </ThemedText>
            ) : null}
            {aspiration.estimatedCost ? (
              <ThemedText color="secondary">
                Perkiraan biaya: {formatRupiah(aspiration.estimatedCost)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.voteRow, { gap: spacing(3) }]}>
          <ThemedText color="secondary">{aspiration.voteCount} warga memilih</ThemedText>
          <Button
            text={hasVoted ? 'Sudah Dipilih' : 'Pilih'}
            variant={hasVoted ? 'ghost' : 'secondary'}
            disabled={hasVoted || !canVote}
            onPress={handleVote}
          />
        </View>
        {!hasVoted && !canVote ? (
          <ThemedText variant="micro" color="muted">
            Voting hanya berlaku untuk aspirasi di kelurahan Anda selama periode voting aktif.
          </ThemedText>
        ) : null}

        {/* Jejak dampak: dari aspirasi warga sampai realisasi anggaran nyata
            (issue #9, kriteria "impact trace visible from aspiration to
            budget item realization"). Dibuat menonjol dengan bingkai dan
            latar berbeda agar tidak terkubur di antara detail lain. */}
        {budgetItem ? (
          <View
            style={[
              styles.impactBox,
              {
                backgroundColor: colors.primarySurface,
                borderColor: colors.primary,
                padding: spacing(4),
                borderRadius: spacing(3),
                gap: spacing(2),
              },
            ]}
          >
            <ThemedText variant="h2">Realisasi Anggaran</ThemedText>
            <ThemedText style={{ fontWeight: '700' }}>{budgetItem.programName}</ThemedText>
            <ThemedText color="secondary">Tahun anggaran {budgetItem.fiscalYear}</ThemedText>

            <View style={{ gap: spacing(1) }}>
              <ThemedText variant="caption" color="secondary">
                Progres: {budgetItem.progressPercent}%
              </ThemedText>
              <View style={[styles.progressTrack, { backgroundColor: colors.border, borderRadius: spacing(1) }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${budgetItem.progressPercent}%`,
                      backgroundColor: colors.primary,
                      borderRadius: spacing(1),
                    },
                  ]}
                />
              </View>
            </View>

            <ThemedText color="secondary">
              Dianggarkan: {formatRupiah(budgetItem.budgetAllocated)}
            </ThemedText>
            <ThemedText color="secondary">
              Terealisasi: {formatRupiah(budgetItem.budgetRealized)}
            </ThemedText>
            {budgetItem.locationAddress ? (
              <ThemedText color="secondary">Lokasi: {budgetItem.locationAddress}</ThemedText>
            ) : null}
            {budgetItem.contractor ? (
              <ThemedText color="secondary">Pelaksana: {budgetItem.contractor}</ThemedText>
            ) : null}
            {budgetItem.photoUrls.length > 0 ? (
              <ScrollView horizontal contentContainerStyle={{ gap: spacing(2) }}>
                {budgetItem.photoUrls.map((url) => (
                  <Image key={url} source={{ uri: url }} style={[styles.photo, { borderRadius: spacing(2) }]} />
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactBox: {
    borderWidth: 2,
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
  },
  photo: {
    width: 140,
    height: 100,
  },
});
