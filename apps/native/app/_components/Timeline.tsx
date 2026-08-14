import { View, StyleSheet } from 'react-native';
import type { TimelineEntry } from '@repo/supabase';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

const DOT_SIZE = 12;
const LINE_WIDTH = 2;

interface TimelineProps {
  entries: TimelineEntry[];
}

interface Stage {
  key: string;
  title: string;
  entry: TimelineEntry | undefined;
}

function formatStageDate(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  return `${datePart}, ${timePart}`;
}

/**
 * "Riwayat penanganan" — empat tahapan tetap terlepas dari event apa saja
 * yang sudah tercatat di `complaint_timeline`. Entri pertama (kronologis,
 * selalu ada begitu aduan dibuat) melunasi "Laporan terkirim"; event
 * `verified`/`in_progress`/`resolved` masing-masing melunasi tiga tahap
 * berikutnya. Tahap yang belum tercapai tampil pudar dengan "Belum
 * terjadi." dan "—" alih-alih tanggal.
 */
export function Timeline({ entries }: TimelineProps) {
  const { colors, spacing } = useTheme();

  const submitted = entries[0];
  const verified = entries.find((e) => e.eventType === 'verified');
  const inProgress = entries.find((e) => e.eventType === 'in_progress');
  const resolved = entries.find((e) => e.eventType === 'resolved');

  const stages: Stage[] = [
    { key: 'submitted', title: 'Laporan terkirim', entry: submitted },
    { key: 'verified', title: 'Diverifikasi petugas', entry: verified },
    { key: 'in_progress', title: 'Sedang dikerjakan', entry: inProgress },
    { key: 'resolved', title: 'Selesai ditangani', entry: resolved },
  ];

  return (
    <View>
      {stages.map((stage, i) => {
        const done = !!stage.entry;
        const isLast = i === stages.length - 1;
        return (
          <View key={stage.key} style={styles.row}>
            <View style={[styles.markerCol, { marginRight: spacing(3) }]}>
              <View
                style={[
                  styles.dot,
                  { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
                  { backgroundColor: done ? colors.primary : colors.border },
                ]}
              />
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    { width: LINE_WIDTH, backgroundColor: done ? colors.primary : colors.border },
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.content, { paddingBottom: isLast ? 0 : spacing(4), gap: spacing(0.5) }]}>
              <ThemedText variant="body" color={done ? 'primary' : 'muted'} style={styles.title}>
                {stage.title}
              </ThemedText>
              {done ? (
                <ThemedText variant="caption" color="secondary">
                  {formatStageDate(stage.entry!.createdAt)}
                </ThemedText>
              ) : (
                <>
                  <ThemedText variant="caption" color="muted">
                    Belum terjadi.
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    —
                  </ThemedText>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  markerCol: {
    alignItems: 'center',
  },
  dot: {},
  line: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
});
