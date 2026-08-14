import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from './useTheme';

interface LogoProps {
  size?: number;
  style?: ViewStyle;
}

export function Logo({ size = 64, style }: LogoProps) {
  const { colors } = useTheme();

  const ringSize = size * 0.45;
  const ringWidth = size * 0.08;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    >
      <View
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize * 0.5,
          borderWidth: ringWidth,
          borderColor: colors.background,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
