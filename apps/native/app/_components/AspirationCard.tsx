import { Pressable, View, StyleSheet } from 'react-native';
import type { AspirationSummary } from '@repo/supabase';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
import { AspirationStatusBadge } from './Badge';
import { Button } from './Button';

interface AspirationCardProps {
  aspiration: AspirationSummary;
  hasVoted: boolean;
  canVote: boolean;
  voteDisabledReason?: string;
  onPress: () => void;
  onVote: () => void;
}

export function AspirationCard({
  aspiration,
  hasVoted,
  canVote,
  voteDisabledReason,
  onPress,
  onVote,
}: AspirationCardProps) {
  const { colors, spacing } = useTheme();
  const voteDisabled = hasVoted || !canVote;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing(3),
          borderRadius: spacing(3),
          gap: spacing(2),
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ gap: spacing(1) }}>
        <ThemedText variant="h2" numberOfLines={2}>
          {aspiration.title}
        </ThemedText>
        <ThemedText variant="caption" color="secondary" numberOfLines={2}>
          {aspiration.description}
        </ThemedText>
        <AspirationStatusBadge status={aspiration.status} />
      </View>

      <View style={[styles.footer, { gap: spacing(2) }]}>
        <ThemedText variant="caption" color="secondary">
          {aspiration.voteCount} suara
        </ThemedText>
        <Button
          text={hasVoted ? 'Sudah Dipilih' : 'Pilih'}
          variant={hasVoted ? 'ghost' : 'secondary'}
          disabled={voteDisabled}
          onPress={onVote}
          containerStyle={styles.voteButton}
        />
      </View>
      {!hasVoted && !canVote && voteDisabledReason ? (
        <ThemedText variant="micro" color="muted">
          {voteDisabledReason}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteButton: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
