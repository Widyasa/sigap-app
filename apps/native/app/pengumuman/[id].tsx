import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import {
  getAnnouncement,
  markAnnouncementAsRead,
  type Announcement,
} from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { AnnouncementCategoryBadge } from '../_components/Badge';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';
import { timeAgo } from '../_components/timeAgo';

const BOTTOM_BAR_HEIGHT = 88;

/** Ambil inisial dari nama penulis (mis. "Rian A." -> "RA") untuk avatar bulat. */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

/** Format tanggal+jam berbahasa Indonesia (mis. "9 Agustus 2026, 07.42"). */
function formatDateID(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  return `${datePart}, ${timePart}`;
}

export default function PengumumanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await getAnnouncement(supabase, id, user?.id);
      setAnnouncement(data);
    } catch (e) {
      console.error('getAnnouncement error', e);
      setError('Gagal memuat pengumuman.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Menandai dibaca begitu detail terbuka — aman dipanggil berkali-kali
  // (upsert idempotent di markAnnouncementAsRead).
  useEffect(() => {
    if (!id || !user) return;
    markAnnouncementAsRead(supabase, user.id, id).catch((e: unknown) => {
      console.error('markAnnouncementAsRead error', e);
    });
  }, [id, user]);

  const handleOpenAttachment = useCallback(async () => {
    if (!announcement?.attachmentUrl) return;
    try {
      await Linking.openURL(announcement.attachmentUrl);
    } catch (e) {
      console.error('open attachment error', e);
      Alert.alert('Gagal', 'Tidak bisa membuka lampiran. Coba lagi.');
    }
  }, [announcement]);

  const handleShare = useCallback(async () => {
    if (!announcement) return;
    try {
      await Share.share({
        message: announcement.attachmentUrl
          ? `${announcement.title}\n${announcement.attachmentUrl}`
          : announcement.title,
        url: announcement.attachmentUrl ?? undefined,
      });
    } catch (e) {
      console.error('share announcement error', e);
    }
  }, [announcement]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">Memuat…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !announcement) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText color="secondary">{error ?? 'Pengumuman tidak ditemukan.'}</ThemedText>
          <Button text="Kembali" variant="secondary" onPress={() => router.back()} containerStyle={{ marginTop: spacing(3) }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderRadius: spacing(6) }]}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">Pengumuman</ThemedText>
        <Pressable
          onPress={() => console.log('pengumuman detail menu pressed')}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderRadius: spacing(6) }]}
          accessibilityRole="button"
          accessibilityLabel="Menu"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing(4), paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + spacing(6), gap: spacing(4) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.row, { gap: spacing(2) }]}>
          {announcement.category ? <AnnouncementCategoryBadge category={announcement.category} /> : null}
          <ThemedText variant="caption" color="muted">
            {timeAgo(announcement.publishedAt)}
          </ThemedText>
        </View>

        <ThemedText variant="display">{announcement.title}</ThemedText>

        <View style={[styles.row, { gap: spacing(3) }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySurface, borderRadius: spacing(5) }]}>
            <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
              {getInitials(announcement.authorName)}
            </ThemedText>
          </View>
          <View>
            <ThemedText variant="body" style={{ fontWeight: '700' }}>
              {announcement.authorName ?? 'Admin Kelurahan'}
            </ThemedText>
            <ThemedText variant="micro" color="muted">
              {formatDateID(announcement.publishedAt)}
            </ThemedText>
          </View>
        </View>

        <ThemedText variant="body" color="secondary">
          {announcement.body}
        </ThemedText>

        {announcement.attachmentUrl ? (
          <Pressable
            onPress={handleOpenAttachment}
            style={({ pressed }) => [
              styles.attachmentCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                padding: spacing(3),
                gap: spacing(3),
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={[styles.attachmentIcon, { backgroundColor: colors.primarySurface, borderRadius: spacing(2) }]}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '700' }} numberOfLines={1}>
                {announcement.attachmentName ?? 'Lampiran'}
              </ThemedText>
              <ThemedText variant="micro" color="muted">
                Lampiran · unduh
              </ThemedText>
            </View>
            <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingHorizontal: spacing(4),
            paddingTop: spacing(3),
            paddingBottom: insets.bottom + spacing(3),
            gap: spacing(3),
          },
        ]}
      >
        <Button
          text="Simpan"
          variant="secondary"
          onPress={handleOpenAttachment}
          disabled={!announcement.attachmentUrl}
          containerStyle={{ flex: 1 }}
        />
        <Button text="Bagikan" variant="primary" onPress={handleShare} containerStyle={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
