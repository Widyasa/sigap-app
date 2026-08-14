import type { ComplaintStatus, Urgency, AspirationStatus, ServiceStatus, EmergencyStatus, PointReason, AnnouncementCategory } from '@repo/shared';
import { EMERGENCY_TYPES, ANNOUNCEMENT_CATEGORIES } from '@repo/shared';

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

/** Label tampilan berbahasa Indonesia untuk status aspirasi. */
export const ASPIRATION_STATUS_LABELS: Record<AspirationStatus, string> = {
  voting: 'Voting terbuka',
  musrenbang: 'Dibahas Musrenbang',
  approved: 'Disetujui',
  budgeted: 'Sudah dianggarkan',
  realized: 'Terealisasi',
  rejected: 'Ditolak',
};

/** Label tampilan berbahasa Indonesia untuk status permohonan layanan. */
export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  submitted: 'Diajukan',
  verifying: 'Diverifikasi',
  signing: 'Diproses Tanda Tangan',
  ready: 'Siap Diunduh',
  rejected: 'Ditolak',
  collected: 'Sudah Diambil',
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

/** Label tampilan berbahasa Indonesia untuk status alert darurat SOS. */
export const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  active: 'Menunggu Operator',
  responding: 'Ditanggapi',
  resolved: 'Selesai',
  false_alarm: 'Alarm Palsu',
};

/** Label tampilan berbahasa Indonesia untuk jenis darurat, dikumpulkan dari EMERGENCY_TYPES. */
export const EMERGENCY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMERGENCY_TYPES.map((t) => [t.id, t.label]),
);

/** Label tampilan berbahasa Indonesia untuk alasan mutasi poin (lihat POINT_REASONS di constants.ts). */
export const POINT_REASON_LABELS: Record<PointReason, string> = {
  report_created: 'Aduan dibuat',
  report_verified: 'Aduan terverifikasi',
  report_resolved: 'Aduan selesai ditangani',
  upvote_given: 'Memberi dukungan aduan',
  aspiration_musrenbang: 'Aspirasi lolos Musrenbang',
  report_false: 'Aduan ditolak (poin dibatalkan)',
};

/** Label tampilan berbahasa Indonesia untuk kategori pengumuman, dikumpulkan dari ANNOUNCEMENT_CATEGORIES. */
export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = Object.fromEntries(
  ANNOUNCEMENT_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<AnnouncementCategory, string>;
