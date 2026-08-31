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
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { completeOnboarding } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await completeOnboarding({
      fullName,
      kecamatan,
      kelurahan,
      address,
      phone,
      rt,
      rw,
    });
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
              Isi nama, alamat lengkap, kecamatan, dan kelurahan agar kami bisa
              menampilkan informasi yang relevan untuk Anda.
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
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Alamat Lengkap"
            placeholder="Jl. Merdeka No. 10, RT 01/RW 02"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Nomor Telepon"
            placeholder="081234567890"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={15}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <View style={{ flexDirection: 'row', marginBottom: spacing(4) }}>
            <Input
              label="RT"
              placeholder="01"
              value={rt}
              onChangeText={setRt}
              containerStyle={{ flex: 1, marginEnd: spacing(3) }}
              maxLength={5}
            />
            <Input
              label="RW"
              placeholder="02"
              value={rw}
              onChangeText={setRw}
              containerStyle={{ flex: 1 }}
              maxLength={5}
            />
          </View>

          {error ? (
            <ThemedText variant="micro" color="danger" style={{ marginTop: spacing(2), marginBottom: spacing(4) }}>
              {error}
            </ThemedText>
          ) : null}

          <Button
            text="Mulai"
            loading={loading}
            onPress={handleSubmit}
            containerStyle={{ marginTop: spacing(2) }}
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
