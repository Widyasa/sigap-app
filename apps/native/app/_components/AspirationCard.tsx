import { Pressable, View, StyleSheet } from 'react-native';
import type { AspirationSummary } from '@repo/supabase';
import { formatRupiah } from '@repo/shared';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
import { useAuth } from './AuthProvider';
import { AspirationStatusBadge } from './Badge';

interface AspirationCardProps {
  aspiration: AspirationSummary;
  rank: number;
  hasVoted: boolean;
  onPress: () => void;
  onVote: () => void;
}
const BUDGETED_STATUSES: Record<string, true> = { budgeted: true, realized: true };
const RANK_CIRCLE_SIZE = 40;

export function AspirationCard({ aspiration, rank, hasVoted, onPress, onVote }: AspirationCardProps) {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const isOwner = user?.id === aspiration.userId;

  const detailLine = BUDGETED_STATUSES[aspiration.status]
    ? `Sudah jadi mata anggaran APBD ${new Date(aspiration.createdAt).getFullYear()}`
    : aspiration.estimatedCost != null
      ? `Kel. ${aspiration.kelurahan} · ${formatRupiah(aspiration.estimatedCost)}`
      : `Kel. ${aspiration.kelurahan}`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing(3),
          borderRadius: spacing(3),
          gap: spacing(3),
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing(3) }]}>
        <View
          style={[
            styles.rankCircle,
            rank === 1
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <ThemedText
            variant="body"
            style={{
              color: rank === 1 ? colors.surface : colors.textPrimary,
              fontWeight: '700',
              textAlign: 'center',
              lineHeight: RANK_CIRCLE_SIZE,
            }}
          >
            {rank}
          </ThemedText>
        </View>

        <View style={{ flex: 1, gap: spacing(1) }}>
          <ThemedText variant="h2" numberOfLines={2}>
            {aspiration.title}
          </ThemedText>
          <AspirationStatusBadge status={aspiration.status} />
          {aspiration.estimatedBeneficiaries != null ? (
            <ThemedText variant="caption" color="secondary">
              {aspiration.estimatedBeneficiaries} penerima manfaat
            </ThemedText>
          ) : null}
          <ThemedText variant="caption" color="secondary">
            {detailLine}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={[styles.footer, { gap: spacing(2) }]}>
        <View style={{ gap: spacing(0.5) }}>
          <ThemedText variant="h1">{aspiration.voteCount}</ThemedText>
          <ThemedText variant="micro" color="muted">
            suara warga
          </ThemedText>
        </View>
        <Pressable
          onPress={isOwner ? onPress : onVote}
          disabled={!isOwner && hasVoted}
          style={({ pressed }) => [
            styles.linkButton,
            isOwner || hasVoted
              ? {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                }
              : { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1 },
            {
              borderRadius: spacing(2),
              paddingHorizontal: spacing(3),
              paddingVertical: spacing(2),
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          <ThemedText
            variant="caption"
            style={{
              color: isOwner || hasVoted ? colors.textPrimary : colors.surface,
              fontWeight: '700',
            }}
          >
            {isOwner ? 'Lihat jejak' : hasVoted ? 'Sudah didukung' : 'Dukung'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rankCircle: {
    width: RANK_CIRCLE_SIZE,
    height: RANK_CIRCLE_SIZE,
    borderRadius: RANK_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
