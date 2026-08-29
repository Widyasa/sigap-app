// Isian surat per jenis layanan.
//
// `supabase/functions/_shared/servicePdf.ts` mencari key-key ini di
// `service_requests.form_data` saat menyusun PDF. Formulir warga TIDAK
// PERNAH menuliskannya: `apps/native/app/layanan/new.tsx` hanya menyimpan
// `catatan` plus jalur berkas tiap persyaratan, sehingga setiap surat yang
// diterbitkan berbunyi "Nama : -", "NIK : -", "Alamat : -" — lengkap dengan
// QR yang memverifikasi dokumen kosong. Jalur OCR yang semestinya mengisi
// field `ktp_*` juga mati: `runOcr` tidak punya satu pun pemanggil.
//
// Berkas ini menjadi sumber tunggal daftar isian itu, dipakai formulir warga
// untuk merender input dan dijaga tetap sinkron dengan `FIELD_LABELS` di
// Edge Function lewat `serviceLetterFields.test.ts`.

import type { ServiceCatalogEntry } from './constants';

export type ServiceTypeId = ServiceCatalogEntry['id'];

export interface ServiceLetterField {
  /** Key di `form_data`; HARUS sama dengan key di `FIELD_LABELS`. */
  key: string;
  label: string;
  /** `date` dirender sebagai pemilih tanggal, `textarea` sebagai kotak panjang. */
  type: 'text' | 'nik' | 'date' | 'textarea';
  placeholder?: string;
}

const IDENTITY: ServiceLetterField[] = [
  { key: 'fullName', label: 'Nama lengkap', type: 'text', placeholder: 'Sesuai KTP' },
  { key: 'nik', label: 'NIK', type: 'nik', placeholder: '16 digit' },
  { key: 'address', label: 'Alamat', type: 'textarea', placeholder: 'Jalan, RT/RW, kelurahan' },
];

export const SERVICE_LETTER_FIELDS: Record<ServiceTypeId, ServiceLetterField[]> = {
  domisili: [
    ...IDENTITY,
    { key: 'purpose', label: 'Keperluan', type: 'text', placeholder: 'Contoh: pendaftaran sekolah' },
  ],
  sktm: [
    ...IDENTITY,
    { key: 'reason', label: 'Alasan permohonan', type: 'textarea', placeholder: 'Contoh: biaya sekolah anak' },
  ],
  pengantar_nikah: [
    ...IDENTITY,
    { key: 'spouseName', label: 'Nama calon pasangan', type: 'text' },
    { key: 'weddingDate', label: 'Rencana tanggal nikah', type: 'date' },
  ],
  izin_keramaian: [
    { key: 'fullName', label: 'Nama penanggung jawab', type: 'text' },
    { key: 'nik', label: 'NIK', type: 'nik', placeholder: '16 digit' },
    { key: 'address', label: 'Alamat', type: 'textarea' },
    { key: 'eventName', label: 'Nama acara', type: 'text' },
    { key: 'eventDate', label: 'Tanggal acara', type: 'date' },
    { key: 'eventLocation', label: 'Lokasi acara', type: 'text' },
  ],
  usaha: [
    { key: 'fullName', label: 'Nama pemilik', type: 'text' },
    { key: 'nik', label: 'NIK', type: 'nik', placeholder: '16 digit' },
    { key: 'address', label: 'Alamat', type: 'textarea' },
    { key: 'businessName', label: 'Nama usaha', type: 'text' },
    { key: 'businessType', label: 'Jenis usaha', type: 'text' },
  ],
  kelahiran: [
    { key: 'fullName', label: 'Nama pelapor', type: 'text' },
    { key: 'nik', label: 'NIK pelapor', type: 'nik', placeholder: '16 digit' },
    { key: 'address', label: 'Alamat', type: 'textarea' },
    { key: 'childName', label: 'Nama anak', type: 'text' },
    { key: 'birthDate', label: 'Tanggal lahir', type: 'date' },
    { key: 'birthPlace', label: 'Tempat lahir', type: 'text' },
    { key: 'motherName', label: 'Nama ibu', type: 'text' },
    { key: 'fatherName', label: 'Nama ayah', type: 'text' },
  ],
  kematian: [
    { key: 'fullName', label: 'Nama pelapor', type: 'text' },
    { key: 'nik', label: 'NIK pelapor', type: 'nik', placeholder: '16 digit' },
    { key: 'address', label: 'Alamat', type: 'textarea' },
    { key: 'deceasedName', label: 'Nama almarhum/almarhumah', type: 'text' },
    { key: 'deceasedNik', label: 'NIK almarhum/almarhumah', type: 'nik', placeholder: '16 digit' },
    { key: 'deathDate', label: 'Tanggal meninggal', type: 'date' },
    { key: 'deathPlace', label: 'Tempat meninggal', type: 'text' },
    { key: 'deathCause', label: 'Sebab kematian', type: 'text' },
  ],
};

/** Isian yang belum diisi, untuk validasi sebelum kirim. */
export function missingLetterFields(
  serviceType: ServiceTypeId,
  values: Record<string, string>,
): ServiceLetterField[] {
  return (SERVICE_LETTER_FIELDS[serviceType] ?? []).filter((f) => !values[f.key]?.trim());
}

/** NIK Indonesia selalu 16 digit. */
export function isValidNik(value: string): boolean {
  return /^\d{16}$/.test(value.trim());
}
