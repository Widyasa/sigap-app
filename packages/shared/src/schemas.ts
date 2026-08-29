import { z } from 'zod';
import { DINAS_LIST, CATEGORY_LIST, URGENCY_VALUES, SERVICE_CATALOG, EMERGENCY_TYPES, ANNOUNCEMENT_CATEGORIES } from './constants';

const dinasIds = DINAS_LIST.map((d) => d.id) as [string, ...string[]];
const categories = CATEGORY_LIST as unknown as [string, ...string[]];

// Batas kasar wilayah Indonesia — mencegah koordinat nol atau salah benua.
const latitude = z.number().min(-11).max(6);
const longitude = z.number().min(95).max(141);

export const createComplaintSchema = z.object({
  description: z.string().trim()
    .min(20, 'Ceritakan lebih detail, minimal 20 karakter').max(2000),
  locationLat: latitude,
  locationLng: longitude,
  locationAddress: z.string().max(300).optional(),
  imageUrls: z.array(z.string().url())
    .min(1, 'Wajib melampirkan minimal satu foto').max(5),
});
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const aiClassificationSchema = z.object({
  title: z.string().trim().min(5).max(120),
  category: z.enum(categories),
  assignedDinas: z.enum(dinasIds),
  urgency: z.enum(URGENCY_VALUES),
  summary: z.string().trim().min(10).max(500),
  confidence: z.number().min(0).max(1),
});
export type AiClassification = z.infer<typeof aiClassificationSchema>;

export const emailSchema = z.string().trim().toLowerCase()
  .email('Alamat email tidak valid').max(254);

export const otpCodeSchema = z.string().trim()
  .regex(/^\d{6}$/, 'Kode terdiri dari enam angka');

export const createAspirationSchema = z.object({
  title: z.string().trim().min(10, 'Judul minimal 10 karakter').max(120),
  description: z.string().trim()
    .min(20, 'Ceritakan lebih detail, minimal 20 karakter').max(2000),
  category: z.string().trim().max(50).optional(),
  estimatedBeneficiaries: z.number().int().positive().optional(),
  estimatedCost: z.number().int().nonnegative().optional(),
  locationLat: latitude.optional(),
  locationLng: longitude.optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type CreateAspirationInput = z.infer<typeof createAspirationSchema>;

export const createVotingPeriodSchema = z.object({
  name: z.string().trim().min(3).max(120),
  fiscalYear: z.number().int().min(2020).max(2100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['endsAt'],
});
export type CreateVotingPeriodInput = z.infer<typeof createVotingPeriodSchema>;

export const ASPIRATION_STATUSES = [
  'voting', 'musrenbang', 'approved', 'budgeted', 'realized', 'rejected',
] as const;
export type AspirationStatus = (typeof ASPIRATION_STATUSES)[number];

/**
 * Mirrors the `votes_insert_own` RLS predicate client-side so the UI can
 * disable the vote button instead of round-tripping to a 403. RLS remains
 * the actual authority — this is UI convenience only (see issue #1: "peran
 * di React Native hanya untuk menyembunyikan tombol").
 */
export function canVoteAspiration(
  voterKelurahan: string | null,
  aspiration: { kelurahan: string; status: AspirationStatus },
  period: { isActive: boolean; startsAt: string; endsAt: string } | null,
  now: Date = new Date(),
): boolean {
  if (!voterKelurahan) return false;
  if (voterKelurahan !== aspiration.kelurahan) return false;
  if (aspiration.status !== 'voting') return false;
  if (!period) return true;
  if (!period.isActive) return false;
  return now >= new Date(period.startsAt) && now <= new Date(period.endsAt);
}

const serviceTypeIds = SERVICE_CATALOG.map((s) => s.id) as [string, ...string[]];

/**
 * `formData` pakai `z.record(z.string())` longgar (bukan skema per-jenis
 * layanan yang ketat) — field yang relevan berbeda per `service_type` (lihat
 * `FIELD_LABELS` di supabase/functions/_shared/servicePdf.ts) dan sumber
 * kebenaran field mana yang dipakai adalah label surat itu sendiri, bukan
 * validasi client. Ketatnya cukup di server: field yang tak dikenal untuk
 * suatu jenis layanan cukup diabaikan saat merender surat.
 */
export const createServiceRequestSchema = z.object({
  serviceType: z.enum(serviceTypeIds),
  formData: z.record(z.string(), z.string().trim()),
  documentUrls: z.array(z.string()).min(1, 'Wajib melampirkan minimal satu dokumen').max(5),
});
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const SERVICE_STATUSES = [
  'submitted', 'verifying', 'signing', 'ready', 'rejected', 'collected',
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

const emergencyTypeIds = EMERGENCY_TYPES.map((e) => e.id) as [string, ...string[]];
const announcementCategoryIds = ANNOUNCEMENT_CATEGORIES.map((c) => c.id) as [string, ...string[]];

/**
 * Skema payload SOS. Beda dengan `createAspirationSchema`, koordinat lokasi
 * WAJIB (bukan optional) — SOS tanpa lokasi tidak berguna bagi operator.
 * `audioUrl` optional karena perekaman audio boleh gagal (izin mikrofon
 * ditolak, dsb.) tanpa memblokir pengiriman SOS (lihat catatan issue #12).
 */
export const createEmergencyAlertSchema = z.object({
  emergencyType: z.enum(emergencyTypeIds),
  locationLat: latitude,
  locationLng: longitude,
  locationAddress: z.string().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
  audioUrl: z.string().optional(),
});
export type CreateEmergencyAlertInput = z.infer<typeof createEmergencyAlertSchema>;

export const EMERGENCY_STATUSES = [
  'active', 'responding', 'resolved', 'false_alarm',
] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

/**
 * Skema pengumuman (M6 Info & Komunitas, issue #13). `kelurahan` kosong
 * berarti berlaku untuk seluruh warga (`NULL` di kolom `announcements.kelurahan`),
 * sesuai kriteria "Announcements can target all users or a specific
 * kelurahan" — free text karena `profiles.kelurahan` juga free text, tidak
 * ada tabel katalog kelurahan (lihat catatan seed.sql).
 */
export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(150),
  body: z.string().trim().min(10, 'Isi minimal 10 karakter').max(5000),
  kelurahan: z.string().trim().min(1).max(100).optional().nullable(),
  dinasId: z.enum(dinasIds).optional(),
  imageUrl: z.string().optional(),
  category: z.enum(announcementCategoryIds).optional(),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
