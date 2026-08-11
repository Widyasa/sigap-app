// Katalog dinas HARUS identik dengan `supabase/seed.sql` (lihat catatan
// "KONSISTENSI KATALOG DINAS" di PRD 6.9). Jika menambah dinas atau
// kategori, ubah kedua berkas dalam commit yang sama.

export interface Dinas {
  id: string;
  name: string;
  categories: string[];
  slaHoursP0: number;
  slaHoursP1: number;
  slaHoursP2: number;
}

export const DINAS_LIST: Dinas[] = [
  {
    id: 'pupr',
    name: 'Dinas Pekerjaan Umum & Penataan Ruang',
    categories: ['jalan_rusak', 'jembatan', 'drainase', 'trotoar'],
    slaHoursP0: 24, slaHoursP1: 72, slaHoursP2: 168,
  },
  {
    id: 'dlh',
    name: 'Dinas Lingkungan Hidup',
    categories: ['sampah', 'pencemaran', 'pohon_tumbang', 'taman_kota'],
    slaHoursP0: 12, slaHoursP1: 48, slaHoursP2: 168,
  },
  {
    id: 'dishub',
    name: 'Dinas Perhubungan',
    categories: ['lampu_lalu_lintas', 'rambu', 'parkir_liar', 'angkutan_umum'],
    slaHoursP0: 12, slaHoursP1: 48, slaHoursP2: 168,
  },
  {
    id: 'dinkes',
    name: 'Dinas Kesehatan',
    categories: ['fasilitas_kesehatan', 'wabah_penyakit', 'sanitasi'],
    slaHoursP0: 6, slaHoursP1: 24, slaHoursP2: 120,
  },
  {
    id: 'disdik',
    name: 'Dinas Pendidikan',
    categories: ['fasilitas_sekolah', 'layanan_pendidikan'],
    slaHoursP0: 24, slaHoursP1: 72, slaHoursP2: 168,
  },
  {
    id: 'satpolpp',
    name: 'Satuan Polisi Pamong Praja',
    categories: ['ketertiban_umum', 'pkl_liar', 'reklame_liar'],
    slaHoursP0: 6, slaHoursP1: 24, slaHoursP2: 120,
  },
  {
    id: 'pdam',
    name: 'Perusahaan Daerah Air Minum',
    categories: ['air_bersih', 'pipa_bocor'],
    slaHoursP0: 12, slaHoursP1: 48, slaHoursP2: 168,
  },
  {
    id: 'lainnya',
    name: 'Belum Terklasifikasi',
    categories: ['lainnya'],
    slaHoursP0: 24, slaHoursP1: 72, slaHoursP2: 168,
  },
];

/** Seluruh kategori aduan, dikumpulkan dari DINAS_LIST tanpa duplikat. */
export const CATEGORY_LIST: string[] = Array.from(
  new Set(DINAS_LIST.flatMap((d) => d.categories)),
);

/** Urgensi: P0 Darurat, P1 Penting, P2 Normal (lihat CONTEXT.md — hindari "prioritas"). */
export const URGENCY_VALUES = ['P0', 'P1', 'P2'] as const;

/** Tahapan siklus hidup aduan, sesuai CHECK constraint tabel `complaints` (6.4). */
export const COMPLAINT_STATUSES = [
  'pending_classification', 'pending', 'verified',
  'in_progress', 'resolved', 'rejected',
] as const;

// Aturan S7/S8: enam digit, berlaku 10 menit, maksimal 5 percobaan salah,
// jeda kirim ulang minimal 60 detik.
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_COOLDOWN_SECONDS = 60;

export type PointReason =
  | 'report_created' | 'report_verified' | 'report_resolved'
  | 'upvote_given' | 'aspiration_musrenbang' | 'report_false';

export const POINT_REASONS: Record<PointReason, number> = {
  report_created: 10,
  report_verified: 25,
  report_resolved: 50,
  upvote_given: 2,
  aspiration_musrenbang: 100,
  report_false: -35,
};

/**
 * Katalog jenis layanan administrasi (M4 Layanan) — daftar tetap yang
 * cocok persis dengan CHECK constraint `service_requests.service_type`
 * (lihat 20260810000004_modules.sql). Ini bukan tabel DB karena nilainya
 * tidak pernah berubah tanpa migrasi skema.
 */
export interface ServiceCatalogEntry {
  id: 'domisili' | 'sktm' | 'pengantar_nikah' | 'izin_keramaian' | 'usaha';
  name: string;
  description: string;
  /** Jenis dokumen yang wajib diunggah warga untuk jenis layanan ini. */
  requiredDocuments: Array<'ktp' | 'kk'>;
}

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  {
    id: 'domisili',
    name: 'Surat Keterangan Domisili',
    description: 'Bukti tempat tinggal untuk keperluan administrasi (sekolah, kerja, bank, dll).',
    requiredDocuments: ['ktp', 'kk'],
  },
  {
    id: 'sktm',
    name: 'Surat Keterangan Tidak Mampu',
    description: 'Keterangan status ekonomi untuk keperluan bantuan sosial, beasiswa, atau keringanan biaya.',
    requiredDocuments: ['ktp', 'kk'],
  },
  {
    id: 'pengantar_nikah',
    name: 'Surat Pengantar Nikah',
    description: 'Pengantar dari kelurahan untuk pendaftaran nikah di KUA.',
    requiredDocuments: ['ktp', 'kk'],
  },
  {
    id: 'izin_keramaian',
    name: 'Surat Izin Keramaian',
    description: 'Izin untuk kegiatan/acara warga yang berpotensi ramai (hajatan, konser lingkungan, dll).',
    requiredDocuments: ['ktp'],
  },
  {
    id: 'usaha',
    name: 'Surat Keterangan Usaha',
    description: 'Keterangan kepemilikan usaha untuk keperluan perizinan atau permodalan.',
    requiredDocuments: ['ktp'],
  },
];
