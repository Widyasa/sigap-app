import { DINAS_LIST } from './constants';
import type { Urgency } from './theme';

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

/**
 * Tenggat SLA dari (dinas, urgensi). Sepadan dengan `computeSlaDueAt` di
 * `supabase/functions/_shared/classification.ts`, yang dipakai jalur
 * klasifikasi AI.
 *
 * Dibutuhkan di sisi klien karena `sla_due_at` DULU hanya pernah ditulis
 * oleh Edge Function `classify-report`. Saat AI tidak tersedia — justru
 * kondisi ketika verifikator mengklasifikasi manual — kolomnya tetap NULL
 * selamanya: countdown SLA menampilkan "—", aduan itu tak pernah masuk
 * hitungan "mendekati batas SLA", dan ia menambah penyebut grafik kepatuhan
 * tanpa pernah bisa masuk pembilangnya.
 */
export function computeSlaDueAt(
  dinas: { slaHoursP0: number; slaHoursP1: number; slaHoursP2: number },
  urgency: Urgency,
  from: Date = new Date(),
): Date {
  const hours =
    urgency === 'P0' ? dinas.slaHoursP0 : urgency === 'P1' ? dinas.slaHoursP1 : dinas.slaHoursP2;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

/** Varian yang mencari dinas dari `DINAS_LIST` lewat id; null bila id tidak dikenal. */
export function slaDueAtForDinas(
  dinasId: string | null | undefined,
  urgency: Urgency | null | undefined,
  from: Date = new Date(),
): string | null {
  if (!dinasId || !urgency) return null;
  const dinas = DINAS_LIST.find((d) => d.id === dinasId);
  if (!dinas) return null;
  return computeSlaDueAt(dinas, urgency, from).toISOString();
}
