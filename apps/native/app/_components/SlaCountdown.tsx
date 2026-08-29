import { useEffect, useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { getSlaStatus, formatSlaCountdown, urgencyColor } from '@repo/shared';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';
const REFRESH_INTERVAL_MS = 30_000;

interface SlaCountdownProps {
  createdAt: string;
  slaDueAt: string | null;
  style?: ViewStyle;
}

/**
 * Countdown SLA yang berubah warna merah begitu sisa waktu turun di bawah
 * 20% (issue #8, kriteria "SLA countdown turns red under 20% remaining
 * time"). Diperbarui tiap 30 detik lewat interval, cukup untuk countdown
 * yang dinyatakan dalam menit/jam — tidak perlu realtime server push.
 */
export function SlaCountdown({ createdAt, slaDueAt, style }: SlaCountdownProps) {
  const { colors, mode } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const status = getSlaStatus(createdAt, slaDueAt, now);
  if (!status) {
    return (
      <View style={style}>
        <ThemedText variant="caption" color="secondary">
          Menunggu klasifikasi untuk menentukan SLA.
        </ThemedText>
      </View>
    );
  }

  const color = status.isCritical ? urgencyColor('P0', mode).fg : colors.textSecondary;
  return (
    <View style={style}>
      <ThemedText variant="caption" style={{ color, fontWeight: status.isCritical ? '700' : '400' }}>
        {formatSlaCountdown(status.remainingMs)}
      </ThemedText>
    </View>
  );
}
