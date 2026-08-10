import { z } from 'zod';
import { DINAS_LIST, CATEGORY_LIST, URGENCY_VALUES } from './constants';

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
