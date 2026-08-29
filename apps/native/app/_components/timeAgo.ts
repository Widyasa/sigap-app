/** Waktu relatif berbahasa Indonesia (mis. "5 menit lalu", "2 hari lalu"). */
export function timeAgo(dateIso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateIso).getTime()) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} minggu lalu`;
  return new Date(dateIso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
