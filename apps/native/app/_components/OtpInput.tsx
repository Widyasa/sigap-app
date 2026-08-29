import { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputKeyPressEventData,
  NativeSyntheticEvent,
  ViewStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export function OtpInput({
  value,
  onChange,
  error,
  disabled,
  containerStyle,
}: OtpInputProps) {
  const { colors, spacing, typography } = useTheme();
  const [focusedIndex, setFocusedIndex] = useState(Math.min(value.length, 5));
  const inputs = useRef<Array<TextInput | null>>([]);

  const digits = value.replace(/\D/g, '').slice(0, 6).split('');
  while (digits.length < 6) digits.push('');

  const focusIndex = (index: number) => {
    if (index >= 0 && index < 6) {
      setFocusedIndex(index);
      inputs.current[index]?.focus();
    }
  };

  const handleChangeText = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);

    if (cleaned.length > 1) {
      // Pasted text: fill all boxes.
      onChange(cleaned);
      focusIndex(Math.min(cleaned.length, 5));
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    const newValue = newDigits.join('').slice(0, 6);
    onChange(newValue);

    if (cleaned && index < 5) {
      focusIndex(index + 1);
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      focusIndex(index - 1);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.row, { gap: spacing(2) }]}>
        {digits.map((digit, index) => {
          const isFocused = focusedIndex === index;
          const borderColor = error
            ? colors.civicAmber
            : isFocused
              ? colors.primary
              : colors.border;

          return (
            <TextInput
              key={index}
              ref={(ref) => {
                inputs.current[index] = ref;
              }}
              style={[
                styles.box,
                {
                  borderColor,
                  borderRadius: spacing(3),
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  fontSize: typography.h1.fontSize,
                  lineHeight: typography.h1.lineHeight,
                  fontWeight: typography.h1.fontWeight,
                },
              ]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              selectTextOnFocus
              editable={!disabled}
              accessibilityLabel={`Digit OTP ${index + 1}`}
              accessibilityHint="Masukkan satu digit kode verifikasi"
              accessibilityState={{ disabled: !!disabled }}
            />
          );
        })}
      </View>
      {error ? (
        <ThemedText
          variant="micro"
          color="danger"
          style={{ marginTop: spacing(2) }}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: 48,
    height: 48,
    borderWidth: 1,
    textAlign: 'center',
    padding: 0,
  },
});
