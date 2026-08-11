import { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { askBudget, type AskBudgetCitedItem } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { Input } from '../_components/Input';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { baseUrl } from '../_components/api';

function reasonToMessage(reason: string | undefined): string {
  switch (reason) {
    case 'no_data':
      return 'Tidak ada data anggaran yang cocok dengan pertanyaan ini. Coba pertanyaan lain, misalnya sebutkan nama dinas atau program.';
    case 'ai_unavailable':
      return 'Asisten AI sedang tidak dapat diakses. Coba lagi nanti.';
    case 'session_expired':
      return 'Sesi habis. Masuk kembali untuk bertanya.';
    default:
      return 'Terjadi kesalahan saat memproses pertanyaan. Coba lagi.';
  }
}

export default function TanyaAnggaranScreen() {
  const { getAccessToken } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [citedItems, setCitedItems] = useState<AskBudgetCitedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitedItems([]);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError(reasonToMessage('session_expired'));
        return;
      }
      const response = await askBudget(baseUrl, token, question.trim());
      if (response.ok && response.answer) {
        setAnswer(response.answer);
        setCitedItems(response.citedItems ?? []);
      } else {
        setError(reasonToMessage(response.reason));
      }
    } catch (e) {
      console.error('askBudget error', e);
      setError(reasonToMessage(undefined));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
        <Button text="< Kembali" variant="ghost" onPress={() => router.back()} containerStyle={styles.backButton} />

        <View style={{ gap: spacing(1) }}>
          <ThemedText variant="h1">Tanya AI tentang Anggaran</ThemedText>
          <ThemedText color="secondary">
            Jawaban hanya berdasarkan data anggaran yang sudah diimpor — tidak ada angka
            karangan.
          </ThemedText>
        </View>

        <View style={{ gap: spacing(2) }}>
          <Input
            label="Pertanyaan"
            placeholder="Contoh: Berapa anggaran perbaikan drainase Jalan Merdeka?"
            value={question}
            onChangeText={setQuestion}
            multiline
          />
          <Button
            text="Tanya"
            onPress={handleAsk}
            loading={loading}
            disabled={!question.trim() || loading}
          />
        </View>

        {error ? <ThemedText color="danger">{error}</ThemedText> : null}

        {answer ? (
          <View
            style={[
              styles.answerBox,
              {
                backgroundColor: colors.primarySurface,
                borderColor: colors.primary,
                padding: spacing(4),
                borderRadius: spacing(3),
                gap: spacing(2),
              },
            ]}
          >
            <ThemedText variant="h2">Jawaban</ThemedText>
            <ThemedText>{answer}</ThemedText>

            {citedItems.length > 0 ? (
              <View style={{ gap: spacing(1), marginTop: spacing(2) }}>
                <ThemedText variant="caption" color="secondary">
                  Sumber data:
                </ThemedText>
                {citedItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/anggaran/item/${item.id}`)}
                    style={({ pressed }) => [
                      styles.citation,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: spacing(2),
                        padding: spacing(2),
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <ThemedText style={{ fontWeight: '700' }} numberOfLines={1}>
                      {item.programName}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary">
                      {item.dinasId}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  answerBox: {
    borderWidth: 2,
  },
  citation: {
    borderWidth: 1,
  },
});
