import type { ComplaintStatus, Urgency } from '@repo/shared';

/** Label tampilan berbahasa Indonesia untuk urgensi aduan (lihat constants.ts). */
export const URGENCY_LABELS: Record<Urgency, string> = {
  P0: 'Darurat',
  P1: 'Penting',
  P2: 'Normal',
};

/** Label tampilan berbahasa Indonesia untuk status aduan. */
export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Sedang Diproses',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

/** Label event timeline aduan (lihat komentar kolom complaint_timeline.event_type). */
export const TIMELINE_EVENT_LABELS: Record<string, string> = {
  created: 'Aduan dibuat',
  ai_classified: 'Diklasifikasi otomatis',
  verified: 'Diverifikasi',
  rejected: 'Ditolak',
  assigned: 'Diteruskan ke dinas',
  in_progress: 'Sedang dikerjakan',
  progress_photo: 'Foto progres ditambahkan',
  resolved: 'Selesai ditangani',
  reopened: 'Dibuka kembali',
  citizen_comment: 'Komentar warga',
};
