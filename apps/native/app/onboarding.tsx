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
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { Input } from './_components/Input';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

export default function OnboardingScreen() {
  const [fullName, setFullName] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { completeOnboarding } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await completeOnboarding({ fullName, kecamatan, kelurahan });
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal menyimpan profil');
      return;
    }
    router.replace('/home');
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
            <ThemedText variant="h1">Lengkapi Profil</ThemedText>
            <ThemedText variant="body" color="secondary">
              Isi nama, kecamatan, dan kelurahan agar kami bisa menampilkan
              informasi yang relevan untuk Anda.
            </ThemedText>
          </View>

          <Input
            label="Nama Lengkap"
            placeholder="Budi Santoso"
            value={fullName}
            onChangeText={setFullName}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Kecamatan"
            placeholder="Cibeunying"
            value={kecamatan}
            onChangeText={setKecamatan}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Kelurahan"
            placeholder="Sukamaju"
            value={kelurahan}
            onChangeText={setKelurahan}
            error={error ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Button
            text="Mulai"
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
