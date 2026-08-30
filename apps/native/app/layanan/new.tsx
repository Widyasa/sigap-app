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
import {
  SERVICE_CATALOG,
  SERVICE_LETTER_FIELDS,
  createServiceRequestSchema,
  isValidNik,
  missingLetterFields,
  type ServiceRequirement,
} from '@repo/shared';
import { createServiceRequest, uploadServiceDocument, runOcr } from '@repo/supabase';
import { baseUrl } from '../_components/api';
import { getAccessToken } from '../_components/session';
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

const MAX_OCR_IMAGE_BASE64_LENGTH = 7_000_000;
const OCR_CONFIDENCE_THRESHOLD = 0.8;

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

interface OcrStatus {
  status: 'loading' | 'done' | 'error';
  message?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const bitmap = (b1 << 16) | ((b2 ?? 0) << 8) | (b3 ?? 0);
    result += BASE64_CHARS[(bitmap >> 18) & 63]!;
    result += BASE64_CHARS[(bitmap >> 12) & 63]!;
    result += b2 !== undefined ? BASE64_CHARS[(bitmap >> 6) & 63]! : '=';
    result += b3 !== undefined ? BASE64_CHARS[bitmap & 63]! : '=';
  }
  return result;
}

function getOcrDocumentType(key: string): 'ktp' | 'kk' | null {
  const lower = key.toLowerCase();
  if (lower.includes('ktp')) return 'ktp';
  if (lower.includes('kk')) return 'kk';
  return null;
}

function mapOcrFieldsToForm(
  documentType: 'ktp' | 'kk',
  ocrFields: Record<string, { value: string; confidence: number }>,
  allowedKeys: Set<string>,
): Array<{ key: string; value: string; confidence: number }> {
  const mapping: Record<'ktp' | 'kk', Record<string, string[]>> = {
    ktp: {
      nik: ['nik'],
      fullName: ['fullName'],
      address: ['address'],
      birthPlace: ['birthPlace'],
      birthDate: ['birthDate'],
      rt: ['rt'],
      rw: ['rw'],
      kelurahan: ['kelurahan'],
      kecamatan: ['kecamatan'],
      religion: ['religion'],
      maritalStatus: ['maritalStatus'],
      occupation: ['occupation'],
    },
    kk: {
      nomorKK: ['nomorKK'],
      kepalaKeluarga: ['fullName'],
      alamat: ['address'],
      rt: ['rt'],
      rw: ['rw'],
      kelurahan: ['kelurahan'],
      kecamatan: ['kecamatan'],
    },
  };
  const result: Array<{ key: string; value: string; confidence: number }> = [];
  const fieldMap = mapping[documentType];
  for (const [ocrKey, field] of Object.entries(ocrFields)) {
    const targetKeys = fieldMap[ocrKey];
    if (!targetKeys) continue;
    const value = field.value.trim();
    if (!value) continue;
    for (const targetKey of targetKeys) {
      if (allowedKeys.has(targetKey)) {
        result.push({ key: targetKey, value, confidence: field.confidence });
      }
    }
  }
  return result;
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
  const letterFields = useMemo(
    () => (catalogEntry ? SERVICE_LETTER_FIELDS[catalogEntry.id] ?? [] : []),
    [catalogEntry],
  );
  const [letterValues, setLetterValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ocrByKey, setOcrByKey] = useState<Record<string, OcrStatus>>({});
  const [ocrWarnings, setOcrWarnings] = useState<Record<string, boolean>>({});
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

  const runOcrForDocument = useCallback(
    async (requirementKey: string, doc: UploadedDocument) => {
      const documentType = getOcrDocumentType(requirementKey);
      if (!documentType) return;

      setOcrByKey((prev) => ({ ...prev, [requirementKey]: { status: 'loading' } }));
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || !baseUrl) {
          setOcrByKey((prev) => ({
            ...prev,
            [requirementKey]: { status: 'error', message: 'Sesi tidak ditemukan.' },
          }));
          return;
        }

        const imageBase64 = arrayBufferToBase64(doc.arrayBuffer);
        if (imageBase64.length > MAX_OCR_IMAGE_BASE64_LENGTH) {
          setOcrByKey((prev) => ({
            ...prev,
            [requirementKey]: {
              status: 'error',
              message: 'Foto terlalu besar untuk dibaca otomatis.',
            },
          }));
          return;
        }

        const response = await runOcr(
          baseUrl,
          accessToken,
          imageBase64,
          doc.contentType,
          documentType,
        );

        if (response.ok || response.reason === 'low_confidence') {
          const allowedKeys = new Set(letterFields.map((f) => f.key));
          const mapped = mapOcrFieldsToForm(documentType, response.fields ?? {}, allowedKeys);
          if (mapped.length > 0) {
            setLetterValues((prev) => {
              const next = { ...prev };
              for (const { key, value } of mapped) {
                if (!next[key]?.trim()) {
                  next[key] = value;
                }
              }
              return next;
            });
            setOcrWarnings((prev) => {
              const next = { ...prev };
              for (const { key, confidence } of mapped) {
                if (confidence < OCR_CONFIDENCE_THRESHOLD) {
                  next[key] = true;
                } else {
                  delete next[key];
                }
              }
              return next;
            });
          }
          const message =
            response.reason === 'low_confidence'
              ? 'Hasil pembacaan kurang jelas — periksa manual.'
              : mapped.length > 0
                ? 'Data dokumen terbaca.'
                : 'Tidak ada data yang cocok untuk surat ini.';
          setOcrByKey((prev) => ({
            ...prev,
            [requirementKey]: { status: 'done', message },
          }));
        } else {
          setOcrByKey((prev) => ({
            ...prev,
            [requirementKey]: { status: 'error', message: 'Gagal membaca dokumen.' },
          }));
        }
      } catch (e) {
        console.error('ocr error', e);
        setOcrByKey((prev) => ({
          ...prev,
          [requirementKey]: { status: 'error', message: 'Gagal membaca dokumen.' },
        }));
      }
    },
    [letterFields],
  );

  const handlePickPhoto = useCallback(
    async (requirement: ServiceRequirement) => {
      setError(null);
      setOcrByKey((prev) => {
        if (!prev[requirement.key]) return prev;
        const next = { ...prev };
        delete next[requirement.key];
        return next;
      });
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

        const uploadedDoc: UploadedDocument = {
          uri: asset.uri,
          contentType,
          sizeBytes: arrayBuffer.byteLength,
          fileName,
          arrayBuffer,
        };
        setDocuments((prev) => ({ ...prev, [requirement.key]: uploadedDoc }));
        runOcrForDocument(requirement.key, uploadedDoc);
      } catch (e) {
        console.error('pick document error', e);
        setError('Gagal mengambil foto. Coba lagi.');
      } finally {
        setPickingKey(null);
      }
    },
    [runOcrForDocument],
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

    // Validasi isian surat sebelum kirim: surat yang terbit dengan kolom
    // kosong tidak bisa diperbaiki warga setelahnya.
    const missing = missingLetterFields(catalogEntry.id, letterValues);
    const nextErrors: Record<string, string> = {};
    for (const field of missing) nextErrors[field.key] = 'Wajib diisi.';
    for (const field of letterFields) {
      if (field.type === 'nik' && letterValues[field.key]?.trim() && !isValidNik(letterValues[field.key]!)) {
        nextErrors[field.key] = 'NIK harus 16 digit angka.';
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError('Lengkapi data untuk surat terlebih dahulu.');
      return;
    }
    setFieldErrors({});

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const formData: Record<string, string> = { catatan: note.trim() };
      // Isian surat ikut disimpan agar `formatLetterFields` punya nilainya.
      for (const field of letterFields) {
        formData[field.key] = (letterValues[field.key] ?? '').trim();
      }
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
  }, [catalogEntry, user, remaining, note, requirements, documents, router, letterFields, letterValues]);

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
                      <>
                        <ThemedText variant="caption" style={{ color: colors.primary }}>
                          {doc.fileName} · {formatBytes(doc.sizeBytes)}
                        </ThemedText>
                        {(() => {
                          const ocrStatus = ocrByKey[requirement.key];
                          if (!ocrStatus) return null;
                          if (ocrStatus.status === 'loading') {
                            return (
                              <ThemedText variant="caption" color="secondary">
                                Membaca dokumen…
                              </ThemedText>
                            );
                          }
                          const statusColor =
                            ocrStatus.status === 'error' ? colors.danger : colors.primary;
                          return (
                            <ThemedText variant="caption" style={{ color: statusColor }}>
                              {ocrStatus.message}
                            </ThemedText>
                          );
                        })()}
                      </>
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

          {/*
            Isian surat.

            Formulir ini DULU hanya mengumpulkan catatan bebas dan foto
            berkas, sementara `formatLetterFields` di Edge Function mencari
            `fullName`, `nik`, `address`, dan seterusnya — jadi SETIAP surat
            yang diterbitkan berbunyi "Nama : -", "NIK : -", "Alamat : -",
            lengkap dengan QR yang memverifikasi dokumen kosong. Daftar
            isiannya berasal dari `SERVICE_LETTER_FIELDS` di `@repo/shared`,
            yang diuji tetap sinkron dengan `FIELD_LABELS` Edge Function.
          */}
          <View style={{ marginTop: spacing(6), gap: spacing(3) }}>
            <ThemedText variant="h2">Data untuk surat</ThemedText>
            <ThemedText variant="caption" color="secondary">
              Isian ini dicetak apa adanya di surat Anda. Periksa ejaannya.
            </ThemedText>
            {letterFields.map((field) => (
              <View key={field.key} style={{ gap: spacing(1) }}>
                <ThemedText variant="caption" color="secondary">
                  {field.label}
                </ThemedText>
                <TextInput
                  value={letterValues[field.key] ?? ''}
                  onChangeText={(v) => {
                    setLetterValues((prev) => ({ ...prev, [field.key]: v }));
                    if (ocrWarnings[field.key]) {
                      setOcrWarnings((prev) => {
                        if (!prev[field.key]) return prev;
                        const next = { ...prev };
                        delete next[field.key];
                        return next;
                      });
                    }
                  }}
                  placeholder={field.placeholder ?? field.label}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={field.type === 'nik' ? 'number-pad' : 'default'}
                  maxLength={field.type === 'nik' ? 16 : undefined}
                  multiline={field.type === 'textarea'}
                  accessibilityLabel={field.label}
                  style={[
                    field.type === 'textarea' ? styles.textArea : styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: fieldErrors[field.key]
                        ? colors.danger
                        : ocrWarnings[field.key]
                          ? colors.civicAmber
                          : colors.border,
                      borderRadius: spacing(3),
                      color: colors.textPrimary,
                      padding: spacing(3),
                    },
                  ]}
                />
                {fieldErrors[field.key] ? (
                  <ThemedText variant="caption" color="danger">
                    {fieldErrors[field.key]}
                  </ThemedText>
                ) : ocrWarnings[field.key] ? (
                  <ThemedText variant="caption" style={{ color: colors.civicAmber }}>
                    Hasil pembacaan OCR kurang yakin — periksa kembali.
                  </ThemedText>
                ) : null}
              </View>
            ))}
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
            {/* Janji "dihapus 30 hari" DULU ditulis tanpa satu pun job
                penghapusan yang mengimplementasikannya — janji retensi data
                yang tidak ditepati atas pindaian KTP/KK adalah masalah
                kebijakan privasi, bukan sekadar salah tulis. Kalimatnya
                dilunakkan sampai penghapusannya benar-benar ada. */}
            Foto hanya dipakai untuk memverifikasi berkas permohonan ini.
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
    // 16px: di bawah itu Safari iOS otomatis memperbesar viewport saat
    // fokus, dan DESIGN.md melarang teks isi turun di bawah 16px.
    fontSize: 16,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    fontSize: 16,
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
