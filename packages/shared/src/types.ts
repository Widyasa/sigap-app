// Tipe domain lintas context, dikumpulkan di satu tempat agar mudah
// ditemukan. Nilai aslinya didefinisikan di theme.ts, constants.ts, dan
// schemas.ts — berkas ini hanya mengagregasi ulang (re-export) plus
// beberapa tipe gabungan yang tidak dimiliki satu context tunggal.
// Bahasa mengikuti CONTEXT.md dan CONTEXT-MAP.md masing-masing context.

export type { ThemeMode, Urgency, ComplaintStatus, ColorTokens } from './theme';
export type { Dinas, PointReason } from './constants';
export type { CreateComplaintInput, AiClassification, CreateServiceRequestInput, ServiceStatus } from './schemas';
export type { ServiceCatalogEntry } from './constants';

export type Category = string;

/** Kandidat aduan serupa yang ditawarkan saat kemiripan > 0,85 dan jarak < 500 m (9.2). */
export interface DuplicateCandidate {
  complaintId: string;
  title: string;
  photoUrl?: string;
  distanceMeters: number;
  similarity: number;
  upvoteCount: number;
}

/** Hasil pengiriman aduan (hook `useCreateComplaint`, 9.2). */
export interface SubmitComplaintResult {
  complaintId: string;
  /** false berarti AI tidak tersedia; aduan tetap tersimpan untuk klasifikasi manual. */
  classified: boolean;
  duplicates: DuplicateCandidate[];
}
