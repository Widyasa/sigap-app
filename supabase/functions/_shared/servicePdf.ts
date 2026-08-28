/**
 * Logika murni untuk pembuatan surat layanan (generate-service-pdf): memilih
 * kapan verification_code dibuat, menyusun URL verifikasi, dan memformat isi
 * surat per jenis layanan dari `form_data`. Tidak ada panggilan jaringan/PDF
 * di berkas ini — mudah diuji (lihat servicePdf.test.ts). Perakitan byte PDF
 * sendiri (npm:pdf-lib) tetap di index.ts karena butuh runtime Deno nyata.
 */

// Harus tetap sinkron dengan SERVICE_CATALOG (packages/shared/src/constants.ts)
// dan dengan CHECK constraint `service_requests_service_type_check`
// (20260810000004_modules.sql + 20260814000001_extend_service_catalog.sql).
// `kelahiran` dan `kematian` ditambahkan ke katalog dan ke basis data tapi
// tidak pernah sampai ke berkas ini, sehingga SERVICE_TITLES[service_type]
// bernilai undefined dan penerbitan PDF-nya selalu gagal dengan
// `generation_failed` — warga bisa mengajukan surat yang tidak akan pernah
// bisa diterbitkan. Uji `servicePdf.test.ts` menjaga ketujuhnya tetap ada.
export type ServiceType =
  | 'domisili'
  | 'sktm'
  | 'pengantar_nikah'
  | 'izin_keramaian'
  | 'usaha'
  | 'kelahiran'
  | 'kematian';

export const SERVICE_TITLES: Record<ServiceType, string> = {
  domisili: 'SURAT KETERANGAN DOMISILI',
  sktm: 'SURAT KETERANGAN TIDAK MAMPU',
  pengantar_nikah: 'SURAT PENGANTAR NIKAH',
  izin_keramaian: 'SURAT IZIN KERAMAIAN',
  usaha: 'SURAT KETERANGAN USAHA',
  kelahiran: 'SURAT KETERANGAN KELAHIRAN',
  kematian: 'SURAT KETERANGAN KEMATIAN',
};

/**
 * Kode verifikasi dibuat saat PDF dihasilkan (status -> 'ready'), BUKAN saat
 * permohonan diajukan. Alasan: sebagian besar permohonan berakhir `rejected`
 * dan tidak pernah butuh QR; membuat kode di awal hanya memperluas jendela
 * di mana kode "hidup" tanpa dokumen sah di baliknya untuk ditemukan/ditebak.
 * Mengikatnya ke momen penerbitan dokumen membuat "kode ada" secara langsung
 * berarti "dokumen sah ada".
 */
export function generateVerificationCode(): string {
  // 10 karakter base32-ish dari UUID v4 tanpa tanda hubung — cukup unik untuk
  // volume permohonan layanan lokal, jauh lebih pendek dari UUID penuh untuk
  // dikodekan dalam QR dan (bila perlu) diketik ulang manual.
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return uuid.slice(0, 10).toUpperCase();
}

/** URL yang dikodekan ke QR — inilah yang benar-benar dipindai warga/petugas verifikasi. */
export function buildVerificationUrl(webBaseUrl: string, verificationCode: string): string {
  return `${webBaseUrl.replace(/\/$/, '')}/verify/${verificationCode}`;
}

export interface LetterField {
  label: string;
  value: string;
}

const FIELD_LABELS: Record<ServiceType, Record<string, string>> = {
  domisili: {
    fullName: 'Nama', nik: 'NIK', address: 'Alamat', purpose: 'Keperluan',
  },
  sktm: {
    fullName: 'Nama', nik: 'NIK', address: 'Alamat', reason: 'Alasan Permohonan',
  },
  pengantar_nikah: {
    fullName: 'Nama', nik: 'NIK', address: 'Alamat',
    spouseName: 'Nama Calon Pasangan', weddingDate: 'Rencana Tanggal Nikah',
  },
  izin_keramaian: {
    fullName: 'Nama Penanggung Jawab', nik: 'NIK', address: 'Alamat',
    eventName: 'Nama Acara', eventDate: 'Tanggal Acara', eventLocation: 'Lokasi Acara',
  },
  usaha: {
    fullName: 'Nama Pemilik', nik: 'NIK', address: 'Alamat',
    businessName: 'Nama Usaha', businessType: 'Jenis Usaha',
  },
  kelahiran: {
    fullName: 'Nama Pelapor', nik: 'NIK Pelapor', address: 'Alamat',
    childName: 'Nama Anak', birthDate: 'Tanggal Lahir', birthPlace: 'Tempat Lahir',
    motherName: 'Nama Ibu', fatherName: 'Nama Ayah',
  },
  kematian: {
    fullName: 'Nama Pelapor', nik: 'NIK Pelapor', address: 'Alamat',
    deceasedName: 'Nama Almarhum/Almarhumah', deceasedNik: 'NIK Almarhum/Almarhumah',
    deathDate: 'Tanggal Meninggal', deathPlace: 'Tempat Meninggal', deathCause: 'Sebab Kematian',
  },
};

/**
 * Mencari nilai field di `form_data` dengan toleransi terhadap prefiks
 * jenis dokumen (`ktp_`/`kk_`) yang dipakai UI warga saat menyimpan field
 * hasil OCR per dokumen (mis. `ktp_fullName`, `ktp_nik`) — field non-OCR
 * yang diketik warga sendiri (mis. `purpose`, `eventName`) tetap disimpan
 * tanpa prefiks, jadi key polos dicoba lebih dulu.
 */
function resolveFieldValue(formData: Record<string, unknown>, key: string): string {
  const candidates = [formData[key], formData[`ktp_${key}`], formData[`kk_${key}`]];
  const raw = candidates.find((v) => typeof v === 'string' && v.trim());
  return typeof raw === 'string' ? raw.trim() : '-';
}


export function formatLetterFields(
  serviceType: ServiceType,
  formData: Record<string, unknown>,
): LetterField[] {
  const labels = FIELD_LABELS[serviceType];
  return Object.entries(labels).map(([key, label]) => ({
    label,
    value: resolveFieldValue(formData, key),
  }));
}
