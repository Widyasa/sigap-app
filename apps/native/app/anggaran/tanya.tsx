import { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { askBudget, type AskBudgetCitedItem } from '@repo/supabase';
import { baseUrl } from '../_components/api';
import { ThemedText } from '../_components/ThemedText';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
function reasonToMessage(reason: string | undefined): string {
  switch (reason) {
    case 'config_error':
      return 'Konfigurasi asisten belum lengkap. Hubungi admin.';
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

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  citedItems?: AskBudgetCitedItem[];
};

export default function TanyaAnggaranScreen() {
  const { getAccessToken } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      sender: 'assistant',
      text: 'Tanya apa saja soal belanja kelurahan',
      citedItems: undefined,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    'Bidang mana serapannya paling lambat?',
    'Berapa anggaran terbesar di Kelurahan Dago?',
    'Dinas mana realisasinya paling tinggi?',
  ];

  const handleAsk = async (q: string) => {
    if (!q.trim()) return;
    
    const userMessage: Message = { id: Date.now().toString(), text: q, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setMessages((prev) => [...prev, { 
          id: (Date.now() + 1).toString(), 
          sender: 'assistant', 
          text: reasonToMessage('session_expired')
        }]);
        return;
      }
      const response = await askBudget(baseUrl, token, q);
      
      if (response.ok && response.answer) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: response.answer,
          citedItems: response.citedItems,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.error('askBudget error', response);
        setMessages((prev) => [...prev, { 
          id: (Date.now() + 1).toString(), 
          sender: 'assistant', 
          text: reasonToMessage(response.reason) 
        }]);
      }
    } catch (e) {
      console.error('askBudget error', e);
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: 'assistant', 
        text: reasonToMessage(undefined) 
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { padding: spacing(4), borderBottomWidth: 1, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.textPrimary} /></Pressable>
        <ThemedText style={{ fontSize: 18, fontWeight: 'bold' }}>SIGAP</ThemedText>
        <Ionicons name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
      </View>
      <View style={[styles.subheader, { padding: spacing(4), backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
          <View style={{ backgroundColor: colors.accent, padding: spacing(2), borderRadius: spacing(2) }}>
            <Ionicons name="document-text" size={20} color={colors.surface} />
          </View>
          <View>
            <ThemedText style={{ fontWeight: 'bold' }}>Asisten Anggaran</ThemedText>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>Data APBD Kel. Dago 2026</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: spacing(4) }}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.sender === 'user' ? { alignSelf: 'flex-end', backgroundColor: colors.primary } : { alignSelf: 'flex-start', backgroundColor: colors.surface }]}>
            {m.id === 'intro' ? (
              <View style={{ gap: spacing(1) }}>
                <ThemedText style={{ fontWeight: 'bold' }}>Tanya apa saja soal belanja kelurahan</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>Jawaban disusun dari pagu, realisasi, dan daftar kegiatan 2026 yang tampil di halaman ini.</ThemedText>
              </View>
            ) : (
              <ThemedText style={{ color: m.sender === 'user' ? colors.surface : colors.textPrimary }}>{m.text}</ThemedText>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: colors.surface }]}>
            <ThemedText>...</ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: spacing(2) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2), paddingBottom: spacing(2) }}>
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => handleAsk(s)} style={{ padding: spacing(2), backgroundColor: colors.primarySurface, borderRadius: spacing(4) }}>
              <ThemedText style={{ color: colors.primary, fontSize: 12 }}>{s}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderRadius: spacing(8), paddingHorizontal: spacing(4), flexDirection: 'row', alignItems: 'center' }]}>
          <TextInput value={question} onChangeText={setQuestion} placeholder="Tulis pertanyaan..." placeholderTextColor={colors.textSecondary} style={{ flex: 1, color: colors.textPrimary }} />
          <Pressable onPress={() => handleAsk(question)} disabled={!question.trim()} style={{ padding: spacing(2) }}>
            <Ionicons name="chevron-forward-circle" size={32} color={question.trim() ? colors.primary : colors.border} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subheader: { flexDirection: 'row', alignItems: 'center' },
  bubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: '80%' },
  inputContainer: { borderWidth: 1 },
});
