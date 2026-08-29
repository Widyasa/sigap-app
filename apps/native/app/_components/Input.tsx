import { ReactNode, useState } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  leftIcon?: ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  leftIcon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.civicAmber : focused ? colors.primary : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <ThemedText variant="caption" color="secondary" style={styles.label}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.field,
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor,
            borderRadius: spacing(3),
            paddingHorizontal: spacing(3),
            backgroundColor: colors.surface,
            gap: spacing(2),
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          style={[
            {
              flex: 1,
              paddingVertical: spacing(2),
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
              lineHeight: typography.body.lineHeight,
            } as TextStyle,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </View>
      {error ? (
        <ThemedText variant="micro" color="danger" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    marginBottom: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: 4,
  },
});
