import { useEffect, useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { formatSlaCountdown, urgencyColor } from '@repo/shared';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

const REFRESH_INTERVAL_MS = 30_000;

interface VotingCountdownProps {
  periodName: string;
  endsAt: string;
  style?: ViewStyle;
}

/**
 * Hitung mundur periode voting aktif, mengikuti gaya `SlaCountdown` —
 * berubah merah begitu sisa waktu di bawah 20% dari total durasi periode.
 */
export function VotingCountdown({ periodName, endsAt, style }: VotingCountdownProps) {
  const { colors, mode } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const remainingMs = new Date(endsAt).getTime() - now.getTime();
  const isOverdue = remainingMs <= 0;
  const color = isOverdue ? urgencyColor('P0', mode).fg : colors.textSecondary;

  return (
    <View style={style}>
      <ThemedText variant="caption" color="secondary">
        Periode voting: {periodName}
      </ThemedText>
      <ThemedText variant="caption" style={{ color, fontWeight: isOverdue ? '700' : '400' }}>
        {isOverdue ? 'Voting telah ditutup' : `Berakhir dalam ${formatSlaCountdown(remainingMs)}`}
      </ThemedText>
    </View>
  );
}
