import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface DinasCardProps {
  dinasName: string;
  category: string | null;
  slaHours: number | null;
}

/** Kartu "Dinas penanggung jawab" di layar detail aduan. */
export function DinasCard({ dinasName, category, slaHours }: DinasCardProps) {
  const { colors, spacing } = useTheme();

  return (
    <View>
      <ThemedText variant="h2" style={{ marginBottom: spacing(2) }}>
        Dinas penanggung jawab
      </ThemedText>
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
        <View
          style={[
            styles.icon,
            { backgroundColor: colors.primarySurface, borderRadius: spacing(3) },
          ]}
        >
          <Ionicons name="business-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: spacing(0.5) }}>
          <ThemedText variant="body" style={{ fontWeight: '700' }}>
            {dinasName}
          </ThemedText>
          {category
            ? (
              <ThemedText variant="caption" color="secondary">
                {slaHours !== null ? `Kategori ${category} · target ${slaHours} jam` : `Kategori ${category}`}
              </ThemedText>
            )
            : slaHours !== null ? (
              <ThemedText variant="caption" color="secondary">
                Target {slaHours} jam
              </ThemedText>
            ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
