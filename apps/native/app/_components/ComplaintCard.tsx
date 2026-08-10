import { Image, Pressable, View, StyleSheet } from 'react-native';
import type { FeedComplaint } from '@repo/supabase';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
import { UrgencyBadge, StatusBadge } from './Badge';
import { SlaCountdown } from './SlaCountdown';
import { Button } from './Button';

interface ComplaintCardProps {
  complaint: FeedComplaint;
  hasDukung: boolean;
  onPress: () => void;
  onDukung: () => void;
}

export function ComplaintCard({ complaint, hasDukung, onPress, onDukung }: ComplaintCardProps) {
  const { colors, spacing } = useTheme();

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
      <View style={styles.row}>
        {complaint.imageUrls[0] ? (
          <Image source={{ uri: complaint.imageUrls[0] }} style={[styles.thumb, { borderRadius: spacing(2) }]} />
        ) : null}
        <View style={[styles.info, { gap: spacing(1) }]}>
          <ThemedText variant="h2" numberOfLines={2}>
            {complaint.title ?? complaint.description}
          </ThemedText>
          <ThemedText variant="caption" color="secondary" numberOfLines={1}>
            {complaint.kelurahan ?? 'Lokasi tidak diketahui'}
            {complaint.kecamatan ? `, ${complaint.kecamatan}` : ''}
          </ThemedText>
          <View style={[styles.badges, { gap: spacing(1) }]}>
            {complaint.urgency ? <UrgencyBadge urgency={complaint.urgency} /> : null}
            <StatusBadge status={complaint.status} />
          </View>
        </View>
      </View>

      <SlaCountdown createdAt={complaint.createdAt} slaDueAt={complaint.slaDueAt} />

      <View style={[styles.footer, { gap: spacing(2) }]}>
        <ThemedText variant="caption" color="secondary">
          {complaint.upvoteCount} warga mendukung
        </ThemedText>
        <Button
          text={hasDukung ? 'Sudah Didukung' : 'Dukung'}
          variant={hasDukung ? 'ghost' : 'secondary'}
          disabled={hasDukung}
          onPress={onDukung}
          containerStyle={styles.dukungButton}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 72,
  },
  info: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dukungButton: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
