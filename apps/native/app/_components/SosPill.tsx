import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { urgencyColor } from '@repo/shared';
import { useTheme } from './useTheme';
import { ThemedText } from './ThemedText';

export function SosPill() {
  const { colors, mode } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/sos')}
      accessibilityRole="button"
      accessibilityLabel="SOS Darurat"
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: urgencyColor('P0', mode).fg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name="warning" size={18} color={colors.surface} />
      <ThemedText variant="micro" style={{ color: colors.surface, fontWeight: '800', marginLeft: 4 }}>
        SOS
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    elevation: 6,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 20,
  },
});
