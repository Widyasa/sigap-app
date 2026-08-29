// Util murni untuk modul Darurat SOS (M5, issue #12).

/**
 * Durasi tekan-tahan tombol SOS sebelum darurat terkirim (kriteria
 * "press-and-hold SOS") — cukup panjang untuk mencegah tersentuh tak
 * sengaja, cukup pendek untuk tetap terasa cepat saat darurat sungguhan.
 */
export const SOS_HOLD_DURATION_MS = 2000;

/** Target durasi rekaman audio konteks SOS, sesuai kriteria "10s audio". */
export const SOS_AUDIO_DURATION_MS = 10_000;

/**
 * Format ringkas berbahasa Indonesia untuk "waktu sejak" sebuah alert dibuat
 * — dipakai di antrean operator (`apps/web/app/darurat`) untuk menunjukkan
 * berapa lama sebuah SOS sudah menunggu ditanggapi.
 */
export function formatTimeSince(createdAt: string | Date, now: Date = new Date()): string {
  const createdMs = new Date(createdAt).getTime();
  const elapsedMs = Math.max(0, now.getTime() - createdMs);
  const totalMinutes = Math.floor(elapsedMs / 60_000);

  if (totalMinutes < 1) return 'baru saja';
  if (totalMinutes < 60) return `${totalMinutes} menit lalu`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${totalHours} jam ${minutes} menit lalu` : `${totalHours} jam lalu`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days} hari ${hours} jam lalu` : `${days} hari lalu`;
}
