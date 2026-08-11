import { View, StyleSheet, ViewStyle } from 'react-native';
import type { Urgency, ComplaintStatus, AspirationStatus } from '@repo/shared';
import { urgencyColor, statusColor, aspirationStatusColor } from '@repo/shared';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
import { URGENCY_LABELS, STATUS_LABELS, ASPIRATION_STATUS_LABELS } from './labels';

interface ChipProps {
  fg: string;
  bg: string;
  label: string;
  style?: ViewStyle;
}

function Chip({ fg, bg, label, style }: ChipProps) {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg, paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
        style,
      ]}
    >
      <ThemedText variant="micro" style={{ color: fg, fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function UrgencyBadge({ urgency, style }: { urgency: Urgency; style?: ViewStyle }) {
  const { mode } = useTheme();
  const { fg, bg } = urgencyColor(urgency, mode);
  return <Chip fg={fg} bg={bg} label={URGENCY_LABELS[urgency]} style={style} />;
}

export function StatusBadge({ status, style }: { status: ComplaintStatus; style?: ViewStyle }) {
  const { mode } = useTheme();
  const { fg, bg } = statusColor(status, mode);
  return <Chip fg={fg} bg={bg} label={STATUS_LABELS[status]} style={style} />;
}

export function AspirationStatusBadge({ status, style }: { status: AspirationStatus; style?: ViewStyle }) {
  const { mode } = useTheme();
  const { fg, bg } = aspirationStatusColor(status, mode);
  return <Chip fg={fg} bg={bg} label={ASPIRATION_STATUS_LABELS[status]} style={style} />;
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
