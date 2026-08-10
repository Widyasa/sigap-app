import {
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  text: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  containerStyle?: ViewStyle;
  style?: ViewStyle;
}

export function Button({
  text,
  variant = 'primary',
  loading = false,
  disabled,
  containerStyle,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing } = useTheme();

  const base: ViewStyle = {
    minHeight: 48,
    minWidth: 48,
    borderRadius: spacing(2),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  };

  const variants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.primarySurface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const textColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.background,
    secondary: colors.primary,
    ghost: colors.primary,
  };

  const textStyle: TextStyle = {
    color: textColors[variant],
    opacity: loading || disabled ? 0.6 : 1,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        base,
        variants[variant],
        (pressed || disabled) && { opacity: 0.7 },
        containerStyle,
        style,
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      {...rest}
    >
      <ThemedText variant="h2" style={textStyle}>
        {loading ? 'Memuat…' : text}
      </ThemedText>
    </Pressable>
  );
}
