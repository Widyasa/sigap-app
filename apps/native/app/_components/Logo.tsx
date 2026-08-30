import { View, StyleSheet, ViewStyle, Image } from 'react-native';
import { useTheme } from './useTheme';

interface LogoProps {
  size?: number;
  style?: ViewStyle;
}

export function Logo({ size = 64, style }: LogoProps) {
  const { colors } = useTheme();

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
      <Image
        source={require('../../assets/logo-mark.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
        resizeMode="contain"
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