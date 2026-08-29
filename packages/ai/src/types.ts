/**
 * Kontrak tipe untuk seluruh Edge Function AI (PRD v2.0 Bagian 7.2, 7.4, 7.5, 9.5).
 * Berkas ini murni tipe + data shape — tidak ada logika, tidak ada klien AI.
 */

// ---------------------------------------------------------------------------
// Klasifikasi aduan (classify-report)
// ---------------------------------------------------------------------------

export type Urgency = 'P0' | 'P1' | 'P2';

/** Ringkasan dinas dipakai untuk menyusun katalog di prompt klasifikasi. */
export interface DinasSummary {
  id: string;
  name: string;
  categories: string[];
}

/** Baris `dinas` lengkap dengan SLA per tingkat urgensi. */
export interface DinasRow extends DinasSummary {
  slaHoursP0: number;
  slaHoursP1: number;
  slaHoursP2: number;
}

/** Hasil model setelah divalidasi terhadap katalog dinas (lihat `parseClassification`). */
export interface Classification {
  title: string;
  category: string;
  assignedDinas: string;
  urgency: Urgency;
  summary: string;
  confidence: number;
}

/** Baris dari `find_duplicate_complaints`, dipakai layar `report/duplicate`. */
export interface DuplicateCandidate {
  id: string;
  title: string;
  similarity: number;
  distanceMeters: number;
  upvoteCount: number;
}

export interface ClassifyReportRequest {
  complaintId: string;
}

export interface ClassifyReportSuccess {
  ok: true;
  classification: Classification;
  duplicates: DuplicateCandidate[];
}

// ---------------------------------------------------------------------------
// Embedding (embed-text)
// ---------------------------------------------------------------------------

export type EmbeddingTarget = 'complaint' | 'aspiration' | 'budget';

export interface EmbedTextRequest {
  text: string;
  target: EmbeddingTarget;
  id: string;
}

export interface EmbedTextSuccess {
  ok: true;
  dimensions: 384;
}

// ---------------------------------------------------------------------------
// Draf jawaban dinas (draft-response)
// ---------------------------------------------------------------------------

export interface DraftResponseInput {
  title: string;
  description: string;
  dinasName: string;
  status: string;
  timelineNotes: string[];
}

export interface DraftResponseRequest {
  complaintId: string;
}

export interface DraftResponseSuccess {
  ok: true;
  draft: string;
}

// ---------------------------------------------------------------------------
// RAG anggaran (ask-budget)
// ---------------------------------------------------------------------------

/**
 * Mata anggaran seperti dikembalikan oleh `search_budget_items` — dipakai
 * sebagai konteks prompt RAG maupun sebagai `sources` pada respons sukses.
 */
export interface BudgetItem {
  program_name: string;
  activity_name: string | null;
  dinas_id: string;
  budget_allocated: number;
  budget_realized: number;
  kelurahan: string | null;
  progress_percent: number;
}

export interface AskBudgetRequest {
  question: string;
  fiscalYear?: number;
  kelurahan?: string;
}

export interface AskBudgetSuccess {
  ok: true;
  answer: string;
  sources: BudgetItem[];
}

// ---------------------------------------------------------------------------
// OCR dokumen (ocr-doc)
// ---------------------------------------------------------------------------

export type OcrDocType = 'ktp' | 'kk';

/** Satu field hasil OCR beserta tingkat kepercayaan model (0–1). */
export interface OcrFieldValue {
  value: string;
  confidence: number;
}

/** Field yang dikembalikan model vision untuk KTP; KK memakai subset yang relevan. */
export interface OcrFields {
  nik?: OcrFieldValue;
  nama?: OcrFieldValue;
  tempat_lahir?: OcrFieldValue;
  tanggal_lahir?: OcrFieldValue;
  alamat?: OcrFieldValue;
  rt_rw?: OcrFieldValue;
  kelurahan?: OcrFieldValue;
  kecamatan?: OcrFieldValue;
  agama?: OcrFieldValue;
  status_perkawinan?: OcrFieldValue;
}

export interface OcrDocRequest {
  documentUrl: string;
  docType: OcrDocType;
}

export interface OcrDocSuccess {
  ok: true;
  fields: OcrFields;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Kegagalan AI bersama (aturan 7.2 — HTTP 200 dengan ok:false)
// ---------------------------------------------------------------------------

/** Nilai `reason` yang dikenali klien (Tabel 7.2). */
export type AiFailureReason =
  | 'ai_unavailable'
  | 'invalid_code'
  | 'too_many_attempts'
  | 'rate_limited'
  | 'email_failed'
  | 'session_expired'
  | 'account_disabled';

export interface AiFailure {
  ok: false;
  reason: AiFailureReason;
}

export type AiResponse<TSuccess extends { ok: true }> = TSuccess | AiFailure;
