import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface LocationCardProps {
  address: string;
  distanceLabel: string | null;
}

/** Kartu alamat + jarak dari lokasi perangkat, di bawah pratinjau peta. */
export function LocationCard({ address, distanceLabel }: LocationCardProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: spacing(3),
          padding: spacing(3),
          gap: spacing(3),
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: spacing(1.5) }]} />
      <View style={{ flex: 1, gap: spacing(0.5) }}>
        <ThemedText variant="body" style={{ fontWeight: '600' }}>
          {address}
        </ThemedText>
        {distanceLabel ? (
          <ThemedText variant="caption" color="secondary">
            {distanceLabel} dari lokasi Anda
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 4,
  },
});
