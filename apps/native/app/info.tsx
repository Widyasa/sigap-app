import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listAnnouncements,
  listLeaderboard,
  getMyPointLedger,
  getUserTotalPoints,
  type Announcement,
  type KelurahanLeaderboardEntry,
  type PointLedgerEntry,
} from '@repo/supabase';
import { groupPointLedgerByRef, pointsColor, type PointReason } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useAuth } from './_components/AuthProvider';
import { useTheme, type ColorTokens } from './_components/useTheme';
import { supabase } from './_components/supabase';
import { POINT_REASON_LABELS } from './_components/labels';

type Section =
  | { kind: 'header'; title: string }
  | { kind: 'announcement'; announcement: Announcement }
  | { kind: 'empty'; text: string }
  | { kind: 'leaderboardRow'; rank: number; entry: KelurahanLeaderboardEntry; isOwn: boolean }
  | { kind: 'pointsTotal'; total: number }
  | { kind: 'pointGroup'; entries: PointLedgerEntry[] };

export default function InfoScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [leaderboard, setLeaderboard] = useState<KelurahanLeaderboardEntry[]>([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [announcementList, leaderboardList, ledgerList, total] = await Promise.all([
        listAnnouncements(supabase, user?.kelurahan ?? null),
        listLeaderboard(supabase),
        user ? getMyPointLedger(supabase, user.id) : Promise.resolve([]),
        user ? getUserTotalPoints(supabase, user.id) : Promise.resolve(0),
      ]);
      setAnnouncements(announcementList);
      setLeaderboard(leaderboardList);
      setLedger(ledgerList);
      setTotalPoints(total);
    } catch (e) {
      console.error('load info & komunitas error', e);
      setError('Gagal memuat data. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const pointGroups = groupPointLedgerByRef(ledger);

  const sections: Section[] = [
    { kind: 'header', title: 'Pengumuman' },
    ...(announcements.length === 0
      ? [{ kind: 'empty', text: 'Belum ada pengumuman.' } as Section]
      : announcements.map((a): Section => ({ kind: 'announcement', announcement: a }))),
    { kind: 'header', title: 'Peringkat Kelurahan' },
    ...(leaderboard.length === 0
      ? [{ kind: 'empty', text: 'Belum ada data peringkat.' } as Section]
      : leaderboard.map(
          (entry, i): Section => ({
            kind: 'leaderboardRow',
            rank: i + 1,
            entry,
            isOwn: !!user?.kelurahan && entry.kelurahan === user.kelurahan,
          }),
        )),
    { kind: 'header', title: 'Poin Saya' },
    { kind: 'pointsTotal', total: totalPoints },
    ...(pointGroups.length === 0
      ? [{ kind: 'empty', text: 'Belum ada riwayat poin.' } as Section]
      : pointGroups.map((g): Section => ({ kind: 'pointGroup', entries: g.entries }))),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ padding: spacing(4), paddingBottom: spacing(2) }}>
        <ThemedText variant="h1">Info & Komunitas</ThemedText>
      </View>

      {error ? (
        <View style={[styles.center, { padding: spacing(4) }]}>
          <ThemedText color="secondary">{error}</ThemedText>
          <Button text="Coba Lagi" variant="secondary" onPress={load} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s, i) => `${s.kind}-${i}`}
          contentContainerStyle={{ padding: spacing(4), paddingTop: 0, gap: spacing(2) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => renderSection(item, colors, spacing)}
        />
      )}
    </SafeAreaView>
  );
}

function renderSection(
  section: Section,
  colors: ColorTokens,
  spacing: (n: number) => number,
) {
  switch (section.kind) {
    case 'header':
      return (
        <ThemedText variant="h2" style={{ marginTop: spacing(3) }}>
          {section.title}
        </ThemedText>
      );

    case 'empty':
      return (
        <ThemedText variant="caption" color="secondary">
          {section.text}
        </ThemedText>
      );

    case 'announcement': {
      const a = section.announcement;
      return (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing(3), gap: spacing(1) },
          ]}
        >
          <View style={styles.row}>
            <ThemedText variant="body" style={{ fontWeight: '700', flex: 1 }} numberOfLines={2}>
              {a.isPinned ? '📌 ' : ''}
              {a.title}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color="secondary" numberOfLines={4}>
            {a.body}
          </ThemedText>
          <ThemedText variant="micro" color="muted">
            {a.kelurahan ? `Untuk Kelurahan ${a.kelurahan}` : 'Untuk seluruh warga'} ·{' '}
            {new Date(a.publishedAt).toLocaleDateString('id-ID')}
          </ThemedText>
        </View>
      );
    }

    case 'leaderboardRow': {
      const { rank, entry, isOwn } = section;
      return (
        <View
          style={[
            styles.row,
            styles.card,
            {
              backgroundColor: isOwn ? colors.primarySurface : colors.surface,
              borderColor: isOwn ? colors.primary : colors.border,
              padding: spacing(3),
              gap: spacing(2),
            },
          ]}
        >
          <ThemedText variant="body" style={{ fontWeight: '700', width: 28 }}>
            #{rank}
          </ThemedText>
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: isOwn ? '700' : '400' }}>
              {entry.kelurahan}
              {isOwn ? ' (Anda)' : ''}
            </ThemedText>
            <ThemedText variant="micro" color="secondary">
              {entry.citizenCount} warga · {entry.resolvedCount}/{entry.reportCount} aduan selesai
            </ThemedText>
          </View>
          <ThemedText variant="body" style={{ fontWeight: '700' }}>
            {entry.totalPoints} poin
          </ThemedText>
        </View>
      );
    }

    case 'pointsTotal':
      return (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.primarySurface, borderColor: colors.primary, padding: spacing(3) },
          ]}
        >
          <ThemedText variant="caption" color="secondary">
            Total Poin
          </ThemedText>
          <ThemedText variant="display">{section.total}</ThemedText>
        </View>
      );

    case 'pointGroup': {
      const [latest, ...older] = section.entries;
      if (!latest) return null;
      const reversed = older.length > 0;
      return (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing(3), gap: spacing(1) },
          ]}
        >
          {section.entries.map((entry, i) => {
            const { fg } = pointsColor(entry.points, 'light');
            return (
              <View key={entry.id} style={[styles.row, { gap: spacing(2) }]}>
                <ThemedText variant="caption" style={{ flex: 1 }} color={i > 0 ? 'muted' : 'primary'}>
                  {POINT_REASON_LABELS[entry.reason as PointReason] ?? entry.reason}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: fg, fontWeight: '700' }}>
                  {entry.points > 0 ? '+' : ''}
                  {entry.points}
                </ThemedText>
              </View>
            );
          })}
          {reversed ? (
            <ThemedText variant="micro" color="muted">
              Poin awal dibatalkan sebagian — lihat rincian di atas.
            </ThemedText>
          ) : null}
          <ThemedText variant="micro" color="muted">
            {new Date(latest.createdAt).toLocaleDateString('id-ID')}
          </ThemedText>
        </View>
      );
    }

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
