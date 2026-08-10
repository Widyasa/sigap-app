import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { emailSchema } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { Input } from './_components/Input';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestOtp } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const handleSubmit = async () => {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Email tidak valid');
      return;
    }
    setLoading(true);
    const result = await requestOtp(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal mengirim kode');
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: parsed.data, devCode: result.devCode ?? '' },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText variant="h1">Masuk ke SIGAP</ThemedText>
            <ThemedText variant="body" color="secondary">
              Kami akan mengirimkan kode 6 digit ke email Anda. Tidak perlu
              kata sandi.
            </ThemedText>
          </View>

          <Input
            label="Email"
            placeholder="nama@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            error={error ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Button
            text="Kirim Kode"
            loading={loading}
            onPress={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    gap: 12,
    marginBottom: 32,
  },
});
