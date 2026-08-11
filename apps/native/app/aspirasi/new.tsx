import { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAspirationSchema } from '@repo/shared';
import { createAspiration } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { Input } from '../_components/Input';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

export default function NewAspirationScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { spacing, colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [estimatedBeneficiaries, setEstimatedBeneficiaries] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    setError(null);
    setTitleError(null);
    setDescriptionError(null);

    if (!user) {
      setError('Sesi tidak ditemukan. Masuk kembali.');
      return;
    }
    if (!user.kelurahan || !user.kecamatan) {
      setError('Lengkapi kelurahan dan kecamatan pada profil Anda sebelum mengusulkan aspirasi.');
      return;
    }

    const parsed = createAspirationSchema.safeParse({
      title,
      description,
      category: category.trim() || undefined,
      estimatedBeneficiaries: estimatedBeneficiaries.trim()
        ? Number(estimatedBeneficiaries)
        : undefined,
      estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : undefined,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'title') setTitleError(issue.message);
        else if (issue.path[0] === 'description') setDescriptionError(issue.message);
        else setError(issue.message);
      }
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createAspiration(supabase, user.id, parsed.data, {
        kelurahan: user.kelurahan,
        kecamatan: user.kecamatan,
      });
      Alert.alert('Aspirasi terkirim', 'Terima kasih, usulan Anda sudah kami terima.');
      router.replace('/aspirasi');
    } catch (e) {
      console.error('createAspiration error', e);
      setError('Gagal mengirim aspirasi. Periksa koneksi internet dan coba lagi.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [user, title, description, category, estimatedBeneficiaries, estimatedCost, router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText variant="h1">Usulkan Aspirasi</ThemedText>
            <ThemedText variant="body" color="secondary">
              Sampaikan usulan pembangunan untuk kelurahan Anda. Aspirasi dengan suara terbanyak
              akan dibahas di Musrenbang.
            </ThemedText>
          </View>

          <Input
            label="Judul"
            placeholder="Contoh: Perbaikan drainase Jalan Merdeka"
            value={title}
            onChangeText={setTitle}
            error={titleError ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Ceritakan usulannya"
            placeholder="Jelaskan masalah dan manfaat usulan ini bagi warga."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
            error={descriptionError ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Kategori (opsional)"
            placeholder="Contoh: infrastruktur"
            value={category}
            onChangeText={setCategory}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Perkiraan warga terdampak (opsional)"
            placeholder="Contoh: 200"
            keyboardType="number-pad"
            value={estimatedBeneficiaries}
            onChangeText={setEstimatedBeneficiaries}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Input
            label="Perkiraan biaya dalam rupiah (opsional)"
            placeholder="Contoh: 50000000"
            keyboardType="number-pad"
            value={estimatedCost}
            onChangeText={setEstimatedCost}
            error={error ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Button text="Kirim Usulan" loading={submitting} onPress={handleSubmit} />
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
    padding: 24,
  },
  header: {
    gap: 12,
    marginBottom: 24,
  },
});
