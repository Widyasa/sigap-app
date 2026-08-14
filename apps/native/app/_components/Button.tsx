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

  const isDisabled = disabled || loading;

  const base: ViewStyle = {
    minHeight: 48,
    minWidth: 48,
    borderRadius: spacing(3),
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
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const disabledVariants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: {
      backgroundColor: colors.textMuted,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const pressedVariants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: { backgroundColor: colors.primaryPressed },
    secondary: { backgroundColor: colors.primarySurface },
    ghost: { backgroundColor: colors.primarySurface },
  };

  const textColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.surface,
    secondary: colors.primary,
    ghost: colors.primary,
  };

  const disabledTextColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.surface,
    secondary: colors.textMuted,
    ghost: colors.textMuted,
  };

  const textStyle: TextStyle = {
    color: isDisabled ? disabledTextColors[variant] : textColors[variant],
    opacity: loading ? 0.6 : 1,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        base,
        disabled && !loading ? disabledVariants[variant] : variants[variant],
        pressed && !isDisabled && pressedVariants[variant],
        containerStyle,
        style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      {...rest}
    >
      <ThemedText variant="h2" style={textStyle}>
        {loading ? 'Memuat…' : text}
      </ThemedText>
    </Pressable>
  );
}
