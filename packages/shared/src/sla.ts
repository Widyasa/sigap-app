// Countdown SLA aduan (issue #8, kriteria "SLA countdown turns red under
// 20% remaining time"). Persentase dihitung terhadap total durasi SLA
// (sla_due_at - created_at aduan), bukan terhadap SLA penuh dinas, karena
// sla_due_at baru terisi saat klasifikasi AI selesai (lihat
// `computeSlaDueAt` di classify-report) — created_at aduan tetap titik
// awal yang benar untuk warga.

export interface SlaStatus {
  /** 0..1, dijepit ke 0 saat sudah lewat batas. */
  percentRemaining: number;
  /** Sisa waktu dalam milidetik; negatif berarti sudah lewat batas. */
  remainingMs: number;
  isOverdue: boolean;
  /** Lewat batas ATAU sisa waktu di bawah 20% — memicu tampilan merah. */
  isCritical: boolean;
}

export function getSlaStatus(
  createdAt: string | Date,
  slaDueAt: string | Date | null,
  now: Date = new Date(),
): SlaStatus | null {
  if (!slaDueAt) return null;

  const createdMs = new Date(createdAt).getTime();
  const dueMs = new Date(slaDueAt).getTime();
  const nowMs = now.getTime();
  const totalMs = dueMs - createdMs;
  const remainingMs = dueMs - nowMs;
  const isOverdue = remainingMs <= 0;

  // Durasi total tidak valid (<=0) — anggap kritis daripada membagi dengan nol.
  const percentRemaining = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  return {
    percentRemaining,
    remainingMs,
    isOverdue,
    isCritical: isOverdue || percentRemaining < 0.2,
  };
}

/** Format ringkas berbahasa Indonesia untuk ditampilkan di countdown SLA. */
export function formatSlaCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return 'Lewat batas SLA';

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} hari ${hours} jam lagi`;
  if (hours > 0) return `${hours} jam ${minutes} menit lagi`;
  return `${minutes} menit lagi`;
}
