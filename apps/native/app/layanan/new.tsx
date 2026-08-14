import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { SERVICE_CATALOG, createServiceRequestSchema, type ServiceRequirement } from '@repo/shared';
import { createServiceRequest, uploadServiceDocument } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface UploadedDocument {
  uri: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  arrayBuffer: ArrayBuffer;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'application/pdf') return 'pdf';
  return 'jpg';
}

export default function LayananNewScreen() {
  const { serviceType } = useLocalSearchParams<{ serviceType: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const catalogEntry = useMemo(
    () => SERVICE_CATALOG.find((entry) => entry.id === serviceType),
    [serviceType],
  );

  const [documents, setDocuments] = useState<Record<string, UploadedDocument>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

  const requirements = catalogEntry?.requirements ?? [];
  const uploadedCount = requirements.filter((req) => documents[req.key]).length;
  const totalCount = requirements.length;
  const remaining = totalCount - uploadedCount;
  const progress = totalCount === 0 ? 0 : uploadedCount / totalCount;

  const handlePickPhoto = useCallback(
    async (requirement: ServiceRequirement) => {
      setError(null);
      setPickingKey(requirement.key);
      try {
        let result: ImagePicker.ImagePickerResult;
        if (Platform.OS === 'web') {
          result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        } else {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Izin kamera diperlukan',
              `Aktifkan izin kamera untuk memotret ${requirement.label}.`,
            );
            return;
          }
          result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        }
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const contentType = asset.mimeType ?? 'image/jpeg';

        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
          Alert.alert(
            'Berkas terlalu besar',
            `Ukuran ${requirement.label} maksimal 5 MB. Coba foto ulang dengan kualitas lebih rendah.`,
          );
          return;
        }

        const fileName = asset.fileName ?? `${requirement.key}.${extensionFor(contentType)}`;

        setDocuments((prev) => ({
          ...prev,
          [requirement.key]: {
            uri: asset.uri,
            contentType,
            sizeBytes: arrayBuffer.byteLength,
            fileName,
            arrayBuffer,
          },
        }));
      } catch (e) {
        console.error('pick document error', e);
        setError('Gagal mengambil foto. Coba lagi.');
      } finally {
        setPickingKey(null);
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    setError(null);

    if (!catalogEntry) {
      setError('Jenis layanan tidak ditemukan.');
      return;
    }
    if (!user) {
      setError('Sesi tidak ditemukan. Masuk kembali.');
      return;
    }
    if (remaining > 0) {
      setError('Semua berkas wajib diunggah terlebih dahulu.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const formData: Record<string, string> = { catatan: note.trim() };
      const documentUrls: string[] = [];

      for (const requirement of requirements) {
        const doc = documents[requirement.key];
        if (!doc) continue;
        const path = await uploadServiceDocument(supabase, user.id, doc.arrayBuffer, doc.contentType);
        documentUrls.push(path);
        formData[requirement.key] = path;
      }

      const input = createServiceRequestSchema.parse({
        serviceType: catalogEntry.id,
        formData,
        documentUrls,
      });

      await createServiceRequest(supabase, user.id, input);

      Alert.alert('Permohonan terkirim', 'Permohonan layanan Anda sudah kami terima.');
      router.replace('/layanan');
    } catch (e) {
      console.error('createServiceRequest error', e);
      setError('Gagal mengirim permohonan. Periksa koneksi internet dan coba lagi.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [catalogEntry, user, remaining, note, requirements, documents, router]);

  if (!catalogEntry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.scroll, styles.center]}>
          <ThemedText color="secondary">Jenis layanan tidak ditemukan.</ThemedText>
          <Pressable onPress={() => router.replace('/layanan')} style={{ marginTop: spacing(3) }}>
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>Kembali</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const ready = remaining <= 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ThemedText variant="micro" color="secondary">
              Pengajuan
            </ThemedText>
            <ThemedText variant="h2">{catalogEntry.name}</ThemedText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing(28) }]}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText variant="h1" style={{ marginTop: spacing(4) }}>
            Unggah berkas yang diminta
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: spacing(1) }}>
            Pastikan seluruh bagian dokumen terlihat, tidak buram, dan tidak tertutup jari.
          </ThemedText>

          <View style={{ marginTop: spacing(4) }}>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.border, borderRadius: spacing(2) }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: colors.primary,
                    borderRadius: spacing(2),
                  },
                ]}
              />
            </View>
            <ThemedText variant="caption" color="secondary" style={{ marginTop: spacing(1) }}>
              {uploadedCount}/{totalCount}
            </ThemedText>
          </View>

          <View style={{ marginTop: spacing(5), gap: spacing(3) }}>
            {requirements.map((requirement) => {
              const doc = documents[requirement.key];
              const picking = pickingKey === requirement.key;
              return (
                <View
                  key={requirement.key}
                  style={[
                    styles.docRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: spacing(3),
                      padding: spacing(3),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.docIcon,
                      {
                        borderColor: doc ? colors.primary : colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Ionicons
                      name={doc ? 'checkmark-circle' : 'document-outline'}
                      size={20}
                      color={doc ? colors.primary : colors.textMuted}
                    />
                  </View>

                  <View style={{ flex: 1, gap: spacing(0.5) }}>
                    <ThemedText variant="body" style={{ fontWeight: '600' }}>
                      {requirement.label}
                    </ThemedText>
                    {doc ? (
                      <ThemedText variant="caption" style={{ color: colors.primary }}>
                        {doc.fileName} · {formatBytes(doc.sizeBytes)}
                      </ThemedText>
                    ) : (
                      <ThemedText variant="caption" color="muted">
                        Belum diunggah · JPG atau PNG, maks 5 MB
                      </ThemedText>
                    )}
                  </View>

                  <Pressable
                    onPress={() => handlePickPhoto(requirement)}
                    disabled={picking}
                    style={[
                      styles.uploadButton,
                      {
                        backgroundColor: doc ? 'transparent' : colors.primary,
                        borderColor: colors.primary,
                        borderWidth: doc ? 1 : 0,
                        borderRadius: 999,
                        paddingHorizontal: spacing(3),
                        paddingVertical: spacing(1.5),
                        opacity: picking ? 0.6 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      style={{ color: doc ? colors.primary : colors.surface, fontWeight: '700' }}
                    >
                      {picking ? 'Memuat…' : doc ? 'Ganti' : 'Ambil foto'}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: spacing(6), gap: spacing(2) }}>
            <ThemedText variant="h2">Catatan tambahan</ThemedText>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={catalogEntry.notePlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: spacing(3),
                  color: colors.textPrimary,
                  padding: spacing(3),
                },
              ]}
            />
          </View>

          <ThemedText variant="micro" color="muted" style={{ marginTop: spacing(4) }}>
            Foto hanya dipakai untuk verifikasi berkas ini dan dihapus 30 hari setelah surat terbit.
          </ThemedText>

          {error ? (
            <ThemedText variant="caption" color="danger" style={{ marginTop: spacing(3) }}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.stickyBar,
            { backgroundColor: colors.surface, borderTopColor: colors.border, padding: spacing(4) },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!ready || submitting}
            style={[
              styles.submitButton,
              {
                backgroundColor: ready ? colors.primary : colors.textMuted,
                borderRadius: spacing(3),
                opacity: submitting ? 0.7 : 1,
              },
            ]}
          >
            <ThemedText variant="body" style={{ color: colors.surface, fontWeight: '700' }}>
              {submitting
                ? 'Mengirim…'
                : ready
                  ? 'Ajukan permohonan'
                  : `Unggah ${remaining} berkas lagi`}
            </ThemedText>
          </Pressable>
        </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    fontSize: 15,
  },
  stickyBar: {
    borderTopWidth: 1,
  },
  submitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
