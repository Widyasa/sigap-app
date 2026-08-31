import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DINAS_LIST,
  URGENCY_VALUES,
  type Urgency,
} from '@repo/shared';
import {
  getComplaint,
  updateComplaintClassification,
  type ComplaintDetail,
} from '@repo/supabase';
import { classifyComplaint } from '../../_components/api';
import { ThemedText } from '../../_components/ThemedText';
import { Button } from '../../_components/Button';
import { UrgencyBadge } from '../../_components/Badge';
import { PhotoCarousel } from '../../_components/PhotoCarousel';
import { StaticMapPreview } from '../../_components/StaticMapPreview';
import { LocationCard } from '../../_components/LocationCard';
import { useAuth } from '../../_components/AuthProvider';
import { useTheme } from '../../_components/useTheme';
import { supabase } from '../../_components/supabase';

interface DraftClassification {
  title: string;
  summary: string;
  assignedDinas: string;
  urgency: Urgency;
  category: string;
  confidence: number | null;
}

function dinasName(id: string | null): string {
  if (!id) return 'Belum ditentukan';
  return DINAS_LIST.find((d) => d.id === id)?.name ?? id;
}

function initialDraft(complaint: ComplaintDetail | null): DraftClassification {
  const assignedDinas = complaint?.assignedDinas ?? DINAS_LIST[0]!.id;
  return {
    title: complaint?.title ?? '',
    summary: complaint?.aiSummary ?? '',
    assignedDinas,
    urgency: complaint?.urgency ?? 'P2',
    category:
      complaint?.category ??
      DINAS_LIST.find((d) => d.id === assignedDinas)?.categories[0] ??
      '',
    confidence: null,
  };
}

export default function ComplaintReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const { colors, spacing, mode } = useTheme();
  const insets = useSafeAreaInsets();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [draft, setDraft] = useState<DraftClassification>(initialDraft(null));
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getComplaint(supabase, id);
      setComplaint(detail);
      setDraft(initialDraft(detail));
    } catch (e) {
      console.error('getComplaint error', e);
      setError('Gagal memuat aduan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runClassification = useCallback(async () => {
    if (!id || !complaint) return;
    if (complaint.status !== 'pending_classification') return;
    setAiLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Sesi tidak ditemukan.');
        return;
      }
      const result = await classifyComplaint(id, token);
      if (result.ok && result.classification) {
        const c = result.classification;
        setDraft({
          title: c.title,
          summary: c.summary,
          assignedDinas: c.assignedDinas,
          urgency: c.urgency as Urgency,
          category: c.category,
          confidence: c.confidence,
        });
        // Muat ulang agar status & field tersimpan terbaca.
        await load();
      } else {
        // AI gagal — biarkan pengguna mengoreksi manual.
      }
    } catch (e) {
      console.error('classifyComplaint error', e);
    } finally {
      setAiLoading(false);
    }
  }, [id, complaint, getAccessToken, load]);

  useEffect(() => {
    if (complaint?.status === 'pending_classification') {
      runClassification();
    }
  }, [complaint?.status, runClassification]);

  const handleSaveCorrection = useCallback(async () => {
    if (!complaint || !id) return;
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      Alert.alert('Perbaikan', 'Judul tidak boleh kosong.');
      return;
    }
    setSubmitting(true);
    try {
      await updateComplaintClassification(supabase, id, {
        currentStatus: complaint.status,
        status: complaint.status,
        title: trimmedTitle,
        category: draft.category.trim() || null,
        assignedDinas: draft.assignedDinas,
        urgency: draft.urgency,
        aiSummary: draft.summary.trim() || null,
        currentSlaDueAt: complaint.slaDueAt,
      });
      await load();
      setIsEditing(false);
    } catch (e) {
      console.error('save correction error', e);
      Alert.alert('Gagal menyimpan', 'Perbaikan tidak dapat disimpan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }, [complaint, draft, id, load]);

  const handleSendToDinas = useCallback(async () => {
    if (!complaint || !id || !user) return;
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      Alert.alert('Periksa kembali', 'Judul tidak boleh kosong.');
      return;
    }
    setSubmitting(true);
    try {
      // Finalisasi: pastikan status pending (petugas verifier akan meninjau).
      await updateComplaintClassification(supabase, id, {
        currentStatus: complaint.status,
        status: 'pending',
        title: trimmedTitle,
        category: draft.category.trim() || null,
        assignedDinas: draft.assignedDinas,
        urgency: draft.urgency,
        aiSummary: draft.summary.trim() || null,
        currentSlaDueAt: complaint.slaDueAt,
      });
      router.replace(`/aduan/${id}`);
    } catch (e) {
      console.error('send to dinas error', e);
      Alert.alert('Gagal mengirim', 'Aduan tidak dapat diteruskan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }, [complaint, draft, id, load, router, user]);

  const coords = useMemo(
    () =>
      complaint
        ? { lat: complaint.locationLat, lng: complaint.locationLng }
        : null,
    [complaint],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText color="secondary" style={{ marginTop: spacing(2) }}>
            Memuat tinjauan…
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !complaint) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.center, { paddingHorizontal: spacing(4), paddingBottom: insets.bottom }]}>
          <ThemedText color="danger">{error ?? 'Aduan tidak ditemukan.'}</ThemedText>
          <Button
            text="Coba lagi"
            variant="secondary"
            onPress={load}
            containerStyle={{ marginTop: spacing(2) }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const classified =
    complaint.status !== 'pending_classification' || draft.confidence !== null;
  const canEdit = complaint.status === 'pending_classification' || complaint.status === 'pending';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">Tinjauan AI</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing(4),
          paddingBottom: insets.bottom + spacing(28),
          gap: spacing(4),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoCarousel imageUrls={complaint.imageUrls} />

        {coords && (
          <>
            <StaticMapPreview coords={coords} markerColor={colors.danger} />
            {complaint.locationAddress ? (
              <LocationCard address={complaint.locationAddress} distanceLabel={null} />
            ) : null}
          </>
        )}

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.surface,
              borderRadius: spacing(4),
              padding: spacing(4),
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <ThemedText variant="caption" color="secondary">
            Deskripsi laporan
          </ThemedText>
          <ThemedText variant="body">{complaint.description}</ThemedText>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.surface,
              borderRadius: spacing(4),
              padding: spacing(4),
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText variant="h2">Hasil klasifikasi AI</ThemedText>
            {!isEditing && canEdit && (
              <Pressable
                onPress={() => setIsEditing(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Perbaiki klasifikasi"
              >
                <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                  Perbaiki
                </ThemedText>
              </Pressable>
            )}
          </View>

          {aiLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(2) }}>
              <ActivityIndicator color={colors.primary} />
              <ThemedText color="secondary">Menganalisis aduan…</ThemedText>
            </View>
          ) : !classified ? (
            <ThemedText color="secondary" style={{ marginTop: spacing(2) }}>
              Laporan Anda sudah kami terima. Petugas akan memeriksanya secara manual.
            </ThemedText>
          ) : null}

          {isEditing ? (
            <View style={{ marginTop: spacing(3), gap: spacing(3) }}>
              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="caption" color="secondary">
                  Judul
                </ThemedText>
                <TextInput
                  value={draft.title}
                  onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
                  placeholder="Judul aduan"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      borderRadius: spacing(3),
                      color: colors.textPrimary,
                      padding: spacing(3),
                    },
                  ]}
                />
              </View>

              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="caption" color="secondary">
                  Ringkasan
                </ThemedText>
                <TextInput
                  value={draft.summary}
                  onChangeText={(v) => setDraft((d) => ({ ...d, summary: v }))}
                  placeholder="Ringkasan aduan"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      borderRadius: spacing(3),
                      color: colors.textPrimary,
                      padding: spacing(3),
                    },
                  ]}
                />
              </View>

              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="caption" color="secondary">
                  Dinas penanggung jawab
                </ThemedText>
                <View style={{ gap: spacing(1) }}>
                  {DINAS_LIST.map((d) => {
                    const selected = draft.assignedDinas === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() =>
                          setDraft((prev) => ({
                            ...prev,
                            assignedDinas: d.id,
                            category: d.categories[0] ?? prev.category,
                          }))
                        }
                        style={[
                          styles.optionRow,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primarySurface : colors.background,
                            borderRadius: spacing(3),
                            padding: spacing(2.5),
                          },
                        ]}
                      >
                        <ThemedText
                          variant="body"
                          style={{
                            color: selected ? colors.primaryPressed : colors.textPrimary,
                            fontWeight: selected ? '700' : '400',
                          }}
                        >
                          {d.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="caption" color="secondary">
                  Tingkat urgensi
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: spacing(2) }}>
                  {URGENCY_VALUES.map((u) => {
                    const selected = draft.urgency === u;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => setDraft((d) => ({ ...d, urgency: u }))}
                        style={[
                          styles.urgencyOption,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primarySurface : colors.background,
                            borderRadius: spacing(3),
                            paddingVertical: spacing(1.5),
                            paddingHorizontal: spacing(3),
                          },
                        ]}
                      >
                        <UrgencyBadge urgency={u} withCode />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) }}>
                <Button
                  text="Batal"
                  variant="secondary"
                  onPress={() => {
                    setDraft(initialDraft(complaint));
                    setIsEditing(false);
                  }}
                  containerStyle={{ flex: 1 }}
                />
                <Button
                  text="Simpan"
                  onPress={handleSaveCorrection}
                  disabled={submitting}
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
              <ThemedText variant="h1">{draft.title || 'Aduan Tanpa Judul'}</ThemedText>
              {draft.confidence !== null && (
                <ThemedText variant="caption" color="secondary">
                  Kepercayaan AI {Math.round(draft.confidence * 100)}%
                </ThemedText>
              )}
              <View style={{ flexDirection: 'row', gap: spacing(2), alignItems: 'center' }}>
                <UrgencyBadge urgency={draft.urgency} withCode />
                <ThemedText variant="body" style={{ color: colors.textSecondary }}>
                  {dinasName(draft.assignedDinas)}
                </ThemedText>
              </View>
              {draft.summary ? (
                <View
                  style={[
                    styles.summaryBox,
                    {
                      backgroundColor: colors.background,
                      borderRadius: spacing(3),
                      padding: spacing(3),
                    },
                  ]}
                >
                  <ThemedText variant="caption" color="secondary">
                    Ringkasan AI
                  </ThemedText>
                  <ThemedText variant="body" style={{ marginTop: spacing(1) }}>
                    {draft.summary}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {canEdit && !isEditing && (
          <Button
            text="Kirim ke dinas"
            onPress={handleSendToDinas}
            disabled={submitting || aiLoading}
            containerStyle={{ marginTop: spacing(2) }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    gap: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    fontSize: 16,
  },
  optionRow: {
    borderWidth: 1,
  },
  urgencyOption: {
    borderWidth: 1,
  },
  summaryBox: {
    gap: 4,
  },
});
