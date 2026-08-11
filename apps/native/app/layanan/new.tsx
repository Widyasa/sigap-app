import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { SERVICE_CATALOG, createServiceRequestSchema, serviceStatusColor } from '@repo/shared';
import { createServiceRequest, runOcr, uploadServiceDocument } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { Input } from '../_components/Input';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';
import { baseUrl } from '../_components/api';

type DocumentType = 'ktp' | 'kk';

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ktp: 'KTP',
  kk: 'Kartu Keluarga',
};

// Field bawaan yang ditampilkan bila OCR gagal/tidak tersedia, agar warga
// tetap bisa mengisi manual (lihat kriteria "allow manual entry").
const DEFAULT_FIELDS: Record<DocumentType, string[]> = {
  ktp: ['nama', 'nik', 'alamat', 'tempat_tanggal_lahir'],
  kk: ['nomor_kk', 'nama_kepala_keluarga', 'alamat'],
};

const FIELD_LABELS: Record<string, string> = {
  nama: 'Nama',
  nik: 'NIK',
  alamat: 'Alamat',
  tempat_tanggal_lahir: 'Tempat, Tanggal Lahir',
  nomor_kk: 'Nomor KK',
  nama_kepala_keluarga: 'Nama Kepala Keluarga',
};

function humanizeKey(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OcrFieldState {
  value: string;
  confidence: number;
}

interface PickedPhoto {
  uri: string;
  contentType: string;
  base64: string;
}

interface DocumentState {
  type: DocumentType;
  photo: PickedPhoto | null;
  ocrLoading: boolean;
  ocrNotice: string | null;
  fields: Record<string, OcrFieldState>;
}

export default function LayananNewScreen() {
  const { serviceType } = useLocalSearchParams<{ serviceType: string }>();
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const { colors, spacing, mode } = useTheme();

  const catalogEntry = useMemo(
    () => SERVICE_CATALOG.find((entry) => entry.id === serviceType),
    [serviceType],
  );

  const [documents, setDocuments] = useState<DocumentState[]>(() =>
    (catalogEntry?.requiredDocuments ?? []).map((type) => ({
      type,
      photo: null,
      ocrLoading: false,
      ocrNotice: null,
      fields: {},
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

  const confidenceColor = useCallback(
    (confidence: number) => {
      if (confidence >= 0.8) return serviceStatusColor('ready', mode).fg;
      if (confidence >= 0.5) return serviceStatusColor('signing', mode).fg;
      return serviceStatusColor('rejected', mode).fg;
    },
    [mode],
  );

  const updateDocument = useCallback((docType: DocumentType, patch: Partial<DocumentState>) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.type === docType ? { ...doc, ...patch } : doc)),
    );
  }, []);

  const handlePickPhoto = useCallback(
    async (docType: DocumentType) => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Izin kamera diperlukan',
          `Aktifkan izin kamera untuk memotret ${DOCUMENT_LABELS[docType]}.`,
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) return;
      const contentType = asset.mimeType ?? 'image/jpeg';

      updateDocument(docType, {
        photo: { uri: asset.uri, contentType, base64: asset.base64 },
        ocrLoading: true,
        ocrNotice: null,
        fields: {},
      });

      const fallbackFields = (): Record<string, OcrFieldState> =>
        Object.fromEntries(DEFAULT_FIELDS[docType].map((key) => [key, { value: '', confidence: 0 }]));

      try {
        const token = await getAccessToken();
        if (!token) throw new Error('missing access token');
        const ocrResult = await runOcr(baseUrl, token, asset.base64, contentType, docType);
        if (ocrResult.fields) {
          const fields: Record<string, OcrFieldState> = {};
          for (const [key, field] of Object.entries(ocrResult.fields)) {
            fields[key] = { value: field.value, confidence: field.confidence };
          }
          updateDocument(docType, {
            ocrLoading: false,
            fields,
            ocrNotice: ocrResult.ok
              ? null
              : 'Hasil OCR keyakinan rendah, periksa dan perbaiki bila perlu.',
          });
        } else {
          updateDocument(docType, {
            ocrLoading: false,
            fields: fallbackFields(),
            ocrNotice: 'OCR tidak tersedia, isi manual.',
          });
        }
      } catch (e) {
        console.error('runOcr error', e);
        updateDocument(docType, {
          ocrLoading: false,
          fields: fallbackFields(),
          ocrNotice: 'OCR tidak tersedia, isi manual.',
        });
      }
    },
    [getAccessToken, updateDocument],
  );

  const handleFieldChange = useCallback((docType: DocumentType, key: string, value: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.type === docType
          ? { ...doc, fields: { ...doc.fields, [key]: { ...doc.fields[key], value } } }
          : doc,
      ),
    );
  }, []);

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
    if (documents.some((doc) => !doc.photo)) {
      setError('Semua dokumen wajib difoto terlebih dahulu.');
      return;
    }

    const formData: Record<string, string> = {};
    for (const doc of documents) {
      for (const [key, field] of Object.entries(doc.fields)) {
        formData[`${doc.type}_${key}`] = field.value;
      }
    }

    const preUploadFields = createServiceRequestSchema
      .omit({ documentUrls: true })
      .safeParse({ serviceType: catalogEntry.id, formData });
    if (!preUploadFields.success) {
      setError(preUploadFields.error.issues[0]?.message ?? 'Data permohonan tidak valid.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const documentUrls: string[] = [];
      for (const doc of documents) {
        if (!doc.photo) continue;
        const response = await fetch(doc.photo.uri);
        const arrayBuffer = await response.arrayBuffer();
        const path = await uploadServiceDocument(
          supabase,
          user.id,
          arrayBuffer,
          doc.photo.contentType,
        );
        documentUrls.push(path);
      }

      const input = createServiceRequestSchema.parse({
        ...preUploadFields.data,
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
  }, [catalogEntry, user, documents, router]);

  if (!catalogEntry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.scroll, styles.center]}>
          <ThemedText color="secondary">Jenis layanan tidak ditemukan.</ThemedText>
          <Button
            text="Kembali"
            variant="secondary"
            onPress={() => router.replace('/layanan')}
            containerStyle={{ marginTop: spacing(3) }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText variant="h1">{catalogEntry.name}</ThemedText>
            <ThemedText variant="body" color="secondary">
              {catalogEntry.description}
            </ThemedText>
          </View>

          {documents.map((doc) => (
            <View key={doc.type} style={{ marginBottom: spacing(6) }}>
              <ThemedText variant="h2" style={{ marginBottom: spacing(2) }}>
                {DOCUMENT_LABELS[doc.type]}
              </ThemedText>

              {doc.photo ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: doc.photo.uri }} style={styles.photo} />
                  <Button
                    text="Ambil Ulang"
                    variant="ghost"
                    onPress={() => handlePickPhoto(doc.type)}
                    containerStyle={{ marginTop: spacing(2) }}
                  />
                </View>
              ) : (
                <Button
                  text={`Ambil Foto ${DOCUMENT_LABELS[doc.type]}`}
                  variant="secondary"
                  onPress={() => handlePickPhoto(doc.type)}
                  containerStyle={{ marginBottom: spacing(3) }}
                />
              )}

              {doc.ocrLoading ? (
                <ThemedText variant="caption" color="secondary" style={{ marginTop: spacing(2) }}>
                  Membaca dokumen…
                </ThemedText>
              ) : null}

              {doc.ocrNotice ? (
                <ThemedText
                  variant="caption"
                  color="secondary"
                  style={{ marginTop: spacing(2), marginBottom: spacing(2) }}
                >
                  {doc.ocrNotice}
                </ThemedText>
              ) : null}

              {Object.entries(doc.fields).map(([key, field]) => (
                <View key={key} style={{ marginTop: spacing(3) }}>
                  <Input
                    label={humanizeKey(key)}
                    value={field.value}
                    onChangeText={(value) => handleFieldChange(doc.type, key, value)}
                  />
                  <ThemedText
                    variant="micro"
                    style={{ color: confidenceColor(field.confidence), marginTop: spacing(1) }}
                  >
                    {Math.round(field.confidence * 100)}% yakin
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}

          {error ? (
            <ThemedText variant="micro" color="danger" style={{ marginBottom: spacing(3) }}>
              {error}
            </ThemedText>
          ) : null}

          <Button text="Ajukan Permohonan" loading={submitting} onPress={handleSubmit} />
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    gap: 12,
    marginBottom: 24,
  },
  photoWrap: {
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
});
