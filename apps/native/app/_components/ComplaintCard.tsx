import { Image, Pressable, View, StyleSheet } from 'react-native';
import type { FeedComplaint } from '@repo/supabase';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
import { UrgencyBadge, StatusBadge } from './Badge';
import { SlaCountdown } from './SlaCountdown';
import { getDinasName } from './distance';

interface ComplaintCardProps {
  complaint: FeedComplaint;
  hasDukung: boolean;
  distanceLabel: string;
  onPress: () => void;
}

/**
 * Kartu aduan di bottom sheet feed peta: foto di kiri, badge urgensi+status
 * dan judul di kanan, footer berisi jarak, dukungan, dan sisa SLA.
 */
export function ComplaintCard({ complaint, hasDukung, distanceLabel, onPress }: ComplaintCardProps) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: spacing(3),
          padding: spacing(3),
          gap: spacing(3),
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {complaint.imageUrls[0] ? (
        <Image source={{ uri: complaint.imageUrls[0] }} style={[styles.thumb, { borderRadius: spacing(2) }]} />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbPlaceholder,
            { borderRadius: spacing(2), backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <ThemedText variant="micro" color="muted" align="center">
            foto aduan
          </ThemedText>
        </View>
      )}

      <View style={[styles.info, { gap: spacing(1) }]}>
        <View style={[styles.badges, { gap: spacing(1) }]}>
          {complaint.urgency ? <UrgencyBadge urgency={complaint.urgency} withCode /> : null}
          <StatusBadge status={complaint.status} />
        </View>

        <ThemedText variant="h2" numberOfLines={2}>
          {complaint.title ?? complaint.description}
        </ThemedText>

        <ThemedText variant="caption" color="secondary" numberOfLines={1}>
          {getDinasName(complaint.assignedDinas)}
        </ThemedText>

        <View style={[styles.footer, { gap: spacing(1) }]}>
          <View style={[styles.footerLeft, { gap: spacing(2) }]}>
            <ThemedText variant="caption" color="secondary">
              {distanceLabel}
            </ThemedText>
            <ThemedText variant="caption" color={hasDukung ? 'primary' : 'secondary'}>
              {complaint.upvoteCount} dukungan
            </ThemedText>
          </View>
          <SlaCountdown createdAt={complaint.createdAt} slaDueAt={complaint.slaDueAt} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  thumb: {
    width: 88,
    height: 88,
  },
  thumbPlaceholder: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
  },
  footer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
