// Satu-satunya sumber label tampilan berbahasa Indonesia untuk seluruh
// nilai enum domain. Sebelumnya peta ini hidup di
// `apps/native/app/_components/labels.ts` sementara dashboard web menyalin
// ulang sebagian di lima berkas berbeda — akibatnya `in_progress` tertulis
// "Sedang Diproses" di aplikasi warga tapi "Ditindaklanjuti" di dashboard,
// dan sejumlah nilai enum mentah (`jalan_rusak`, `P0`, `pupr`) bocor apa
// adanya ke layar petugas.

import {
  ANNOUNCEMENT_CATEGORIES,
  CATEGORY_LIST,
  DINAS_LIST,
  EMERGENCY_TYPES,
} from './constants';
import type { AnnouncementCategory, ComplaintStatus, Urgency } from './theme';
import type { AspirationStatus, EmergencyStatus, ServiceStatus } from './schemas';

/** Urgensi: P0 Darurat, P1 Penting, P2 Normal (lihat CONTEXT.md — hindari "prioritas"). */
export const URGENCY_LABELS: Record<Urgency, string> = {
  P0: 'Darurat',
  P1: 'Penting',
  P2: 'Normal',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_classification: 'Menunggu Klasifikasi',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  in_progress: 'Sedang Diproses',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

export const ASPIRATION_STATUS_LABELS: Record<AspirationStatus, string> = {
  voting: 'Voting terbuka',
  musrenbang: 'Dibahas Musrenbang',
  approved: 'Disetujui',
  budgeted: 'Sudah dianggarkan',
  realized: 'Terealisasi',
  rejected: 'Ditolak',
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  submitted: 'Diajukan',
  verifying: 'Diverifikasi',
  signing: 'Diproses Tanda Tangan',
  ready: 'Siap Diunduh',
  rejected: 'Ditolak',
  collected: 'Sudah Diambil',
};

export const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  active: 'Menunggu Operator',
  responding: 'Ditanggapi',
  resolved: 'Selesai',
  false_alarm: 'Alarm Palsu',
};

/** Label event timeline aduan (lihat komentar kolom complaint_timeline.event_type). */
export const TIMELINE_EVENT_LABELS: Record<string, string> = {
  created: 'Aduan dibuat',
  ai_classified: 'Diklasifikasi otomatis',
  pending: 'Menunggu verifikasi',
  verified: 'Diverifikasi',
  rejected: 'Ditolak',
  assigned: 'Diteruskan ke dinas',
  in_progress: 'Sedang dikerjakan',
  progress: 'Catatan progres ditambahkan',
  progress_photo: 'Foto progres ditambahkan',
  resolved: 'Selesai ditangani',
  reopened: 'Dibuka kembali',
  citizen_comment: 'Komentar warga',
};

export const EMERGENCY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMERGENCY_TYPES.map((t) => [t.id, t.label]),
);

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> =
  Object.fromEntries(
    ANNOUNCEMENT_CATEGORIES.map((c) => [c.id, c.label]),
  ) as Record<AnnouncementCategory, string>;

/**
 * Nama kategori aduan yang bisa dibaca manusia. `CATEGORY_LIST` berisi id
 * mentah (`jalan_rusak`, `pkl_liar`) yang sebelumnya tampil apa adanya di
 * dropdown verifikator dan di tabel Ringkasan.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  jalan_rusak: 'Jalan rusak',
  jembatan: 'Jembatan',
  drainase: 'Drainase / saluran air',
  trotoar: 'Trotoar',
  sampah: 'Sampah',
  pencemaran: 'Pencemaran lingkungan',
  pohon_tumbang: 'Pohon tumbang',
  taman_kota: 'Taman kota',
  lampu_lalu_lintas: 'Lampu lalu lintas',
  rambu: 'Rambu lalu lintas',
  parkir_liar: 'Parkir liar',
  angkutan_umum: 'Angkutan umum',
  fasilitas_kesehatan: 'Fasilitas kesehatan',
  wabah_penyakit: 'Wabah penyakit',
  sanitasi: 'Sanitasi',
  fasilitas_sekolah: 'Fasilitas sekolah',
  layanan_pendidikan: 'Layanan pendidikan',
  ketertiban_umum: 'Ketertiban umum',
  pkl_liar: 'PKL liar',
  reklame_liar: 'Reklame liar',
  air_bersih: 'Air bersih',
  pipa_bocor: 'Pipa bocor',
  lainnya: 'Lainnya',
};

/** Label kategori, dengan id mentah sebagai cadangan agar tidak pernah kosong. */
export function categoryLabel(categoryId: string | null | undefined): string {
  if (!categoryId) return '—';
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

/** Nama dinas dari id (`pupr` -> "Dinas Pekerjaan Umum & Penataan Ruang"). */
export function dinasName(dinasId: string | null | undefined): string {
  if (!dinasId) return '—';
  return DINAS_LIST.find((d) => d.id === dinasId)?.name ?? dinasId;
}

/** Setiap kategori di CATEGORY_LIST wajib punya label — dijaga oleh labels.test.ts. */
export const UNLABELLED_CATEGORIES: string[] = CATEGORY_LIST.filter(
  (c) => !(c in CATEGORY_LABELS),
);
