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

export const POINT_REASON_LABELS: Record<PointReason, string> = {
  report_created: 'Laporan dibuat',
  report_verified: 'Laporan diverifikasi',
  report_resolved: 'Laporan selesai',
  report_false: 'Laporan terbukti palsu',
  upvote_given: 'Mendukung laporan warga',
  aspiration_musrenbang: 'Aspirasi lolos ke Musrenbang',
};

/**
 * Katalog jenis layanan administrasi (M4 Layanan) — daftar tetap yang
 * cocok persis dengan CHECK constraint `service_requests.service_type`
 * (lihat 20260810000004_modules.sql). Ini bukan tabel DB karena nilainya
 * tidak pernah berubah tanpa migrasi skema.
 */
export interface ServiceRequirement {
  /** id snake_case dipakai sebagai kunci pemetaan dokumen di `formData`. */
  key: string;
  /** Label yang ditampilkan di formulir pengajuan. */
  label: string;
  acceptedTypes?: string[];
}

export interface ServiceCatalogEntry {
  id:
    | 'domisili' | 'sktm' | 'pengantar_nikah' | 'izin_keramaian' | 'usaha'
    | 'kelahiran' | 'kematian';
  name: string;
  description: string;
  category: 'Kependudukan' | 'Sosial' | 'Usaha' | 'Lainnya';
  /** Estimasi waktu proses, ditampilkan apa adanya (mis. "2 hari kerja"). */
  processingTime: string;
  /** Biaya layanan, ditampilkan apa adanya (mis. "Gratis"). */
  cost: string;
  /** Placeholder untuk field catatan tambahan di formulir pengajuan. */
  notePlaceholder: string;
  /** Dokumen yang wajib diunggah warga untuk jenis layanan ini. */
  requirements: ServiceRequirement[];
}

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  {
    id: 'domisili',
    name: 'Surat Keterangan Domisili',
    description: 'Bukti tempat tinggal untuk keperluan administrasi (sekolah, kerja, bank, dll).',
    category: 'Kependudukan',
    processingTime: '2 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: alamat pada KK berbeda dengan domisili saat ini',
    requirements: [
      { key: 'ktp_elektronik_pemohon', label: 'KTP elektronik pemohon', acceptedTypes: IMAGE_TYPES },
      { key: 'kk_terbaru', label: 'Kartu Keluarga terbaru', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
      { key: 'foto_rumah_tampak_depan', label: 'Foto rumah tampak depan', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'sktm',
    name: 'Surat Keterangan Tidak Mampu',
    description: 'Keterangan status ekonomi untuk keperluan bantuan sosial, beasiswa, atau keringanan biaya.',
    category: 'Sosial',
    processingTime: '3 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: penghasilan keluarga berasal dari ...',
    requirements: [
      { key: 'ktp_dan_kk', label: 'KTP dan Kartu Keluarga', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
      { key: 'slip_penghasilan_atau_surat_pernyataan', label: 'Slip penghasilan atau surat pernyataan', acceptedTypes: IMAGE_TYPES },
      { key: 'foto_kondisi_rumah', label: 'Foto kondisi rumah', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'usaha',
    name: 'Surat Keterangan Usaha',
    description: 'Keterangan kepemilikan usaha untuk keperluan perizinan atau permodalan.',
    category: 'Usaha',
    processingTime: '3 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: usaha berlokasi di rumah tinggal',
    requirements: [
      { key: 'ktp_dan_kk_pemilik_usaha', label: 'KTP dan KK pemilik usaha', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
      { key: 'foto_tempat_usaha', label: 'Foto tempat usaha', acceptedTypes: IMAGE_TYPES },
      { key: 'bukti_sewa_atau_kepemilikan_tempat', label: 'Bukti sewa atau kepemilikan tempat', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'pengantar_nikah',
    name: 'Surat Pengantar Nikah',
    description: 'Pengantar dari kelurahan untuk pendaftaran nikah di KUA.',
    category: 'Sosial',
    processingTime: '2 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: calon pengantin berdomisili di kelurahan ini',
    requirements: [
      { key: 'ktp_elektronik_pemohon', label: 'KTP elektronik pemohon', acceptedTypes: IMAGE_TYPES },
      { key: 'kk_terbaru', label: 'Kartu Keluarga terbaru', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
      { key: 'pas_foto_3x4_merah', label: 'Pas foto 3x4 latar merah', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'izin_keramaian',
    name: 'Surat Izin Keramaian',
    description: 'Izin untuk kegiatan/acara warga yang berpotensi ramai (hajatan, konser lingkungan, dll).',
    category: 'Lainnya',
    processingTime: '5 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: kegiatan di Jalan Mawar tanggal 20 Agustus',
    requirements: [
      { key: 'ktp_elektronik_pemohon', label: 'KTP elektronik pemohon', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
      { key: 'proposal_kegiatan', label: 'Proposal kegiatan', acceptedTypes: IMAGE_TYPES },
      { key: 'surat_pernyataan_tanggung_jawab', label: 'Surat pernyataan tanggung jawab', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'kelahiran',
    name: 'Surat Keterangan Kelahiran',
    description: 'Pengantar kelurahan sebagai dasar pengurusan akta kelahiran di Dukcapil.',
    category: 'Kependudukan',
    processingTime: '3 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: anak pertama dari pasangan ...',
    requirements: [
      { key: 'surat_keterangan_lahir', label: 'Surat keterangan lahir dari bidan/RS', acceptedTypes: IMAGE_TYPES },
      { key: 'ktp_orang_tua', label: 'KTP orang tua', acceptedTypes: IMAGE_TYPES },
      { key: 'kk_terbaru', label: 'Kartu Keluarga terbaru', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
    ],
  },
  {
    id: 'kematian',
    name: 'Surat Keterangan Kematian',
    description: 'Pengantar kelurahan sebagai dasar pengurusan akta kematian di Dukcapil.',
    category: 'Kependudukan',
    processingTime: '3 hari kerja',
    cost: 'Gratis',
    notePlaceholder: 'Contoh: almarhum bertempat tinggal di ...',
    requirements: [
      { key: 'surat_keterangan_kematian', label: 'Surat keterangan kematian dari RS/faskes', acceptedTypes: IMAGE_TYPES },
      { key: 'ktp_pelapor', label: 'KTP pelapor', acceptedTypes: IMAGE_TYPES },
      { key: 'ktp_almarhum', label: 'KTP almarhum/almarhumah', acceptedTypes: IMAGE_TYPES },
      { key: 'kk_terbaru', label: 'Kartu Keluarga terbaru', acceptedTypes: IMAGE_TYPES },
      { key: 'pengantar_rt_rw', label: 'Surat pengantar RT dan RW', acceptedTypes: IMAGE_TYPES },
    ],
  },
];

/**
 * Katalog jenis darurat SOS (M5 Darurat) — daftar tetap yang cocok persis
 * dengan CHECK constraint `emergency_alerts.emergency_type` (lihat
 * 20260810000004_modules.sql). Bukan tabel DB, sama seperti SERVICE_CATALOG,
 * karena nilainya tidak pernah berubah tanpa migrasi skema.
 */
export interface EmergencyTypeEntry {
  id: 'fire' | 'medical' | 'flood' | 'crime' | 'tree' | 'other';
  label: string;
  icon: string;
}

export const EMERGENCY_TYPES: EmergencyTypeEntry[] = [
  { id: 'fire', label: 'Kebakaran', icon: '🔥' },
  { id: 'medical', label: 'Medis', icon: '🚑' },
  { id: 'flood', label: 'Banjir', icon: '🌊' },
  { id: 'crime', label: 'Kriminal', icon: '🚨' },
  { id: 'tree', label: 'Pohon Tumbang', icon: '🌳' },
  { id: 'other', label: 'Lainnya', icon: '⚠️' },
];

/**
 * Katalog kategori pengumuman — HARUS identik dengan CHECK constraint
 * `announcements.category` (lihat 20260814000002_announcements_enhance.sql).
 * Bukan tabel DB, sama seperti EMERGENCY_TYPES, karena nilainya tidak
 * pernah berubah tanpa migrasi skema.
 */
export interface AnnouncementCategoryEntry {
  id: 'darurat' | 'infrastruktur' | 'kesehatan' | 'layanan' | 'kegiatan' | 'umum';
  label: string;
}

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategoryEntry[] = [
  { id: 'darurat', label: 'Darurat' },
  { id: 'infrastruktur', label: 'Infrastruktur' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'layanan', label: 'Layanan' },
  { id: 'kegiatan', label: 'Kegiatan' },
  { id: 'umum', label: 'Umum' },
];

/**
 * Pemetaan dinas ke "bidang" anggaran untuk layar Anggaran (ringkasan per
 * bidang, bukan per dinas mentah) — kriteria "Belanja per bidang" pada
 * mockup. Bukan tabel DB: hanya pengelompokan tampilan dari DINAS_LIST yang
 * sudah ada, jadi tetap satu sumber kebenaran kategori/dinas.
 */
export type BudgetSectorId =
  | 'infrastruktur'
  | 'kesehatan'
  | 'pendidikan_pemuda'
  | 'lingkungan'
  | 'pemerintahan_layanan';

export interface BudgetSector {
  id: BudgetSectorId;
  label: string;
  dinasIds: string[];
}

export const BUDGET_SECTORS: BudgetSector[] = [
  { id: 'infrastruktur', label: 'Infrastruktur', dinasIds: ['pupr', 'dishub', 'pdam'] },
  { id: 'kesehatan', label: 'Kesehatan', dinasIds: ['dinkes'] },
  { id: 'pendidikan_pemuda', label: 'Pendidikan & Pemuda', dinasIds: ['disdik'] },
  { id: 'lingkungan', label: 'Lingkungan', dinasIds: ['dlh'] },
  { id: 'pemerintahan_layanan', label: 'Pemerintahan & Layanan', dinasIds: ['satpolpp', 'lainnya'] },
];

/** Bidang anggaran suatu dinas, atau null bila belum dipetakan. */
export function getBudgetSector(dinasId: string): BudgetSectorId | null {
  const sector = BUDGET_SECTORS.find((s) => s.dinasIds.includes(dinasId));
  return sector ? sector.id : null;
}
