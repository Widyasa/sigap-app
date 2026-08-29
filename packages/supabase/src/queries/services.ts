import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateServiceRequestInput, ServiceStatus } from '@repo/shared';
import type { Database } from '../database.types';

const SERVICE_DOCS_BUCKET = 'service-docs';

// ---------------------------------------------------------------------
// Document upload + signed access (kriteria "Documents stored in private
// bucket and accessed via signed URLs")
// ---------------------------------------------------------------------

type ServiceDocumentBody = ArrayBuffer | Blob;

/**
 * Mengunggah dokumen (KTP/KK/PDF) ke bucket privat `service-docs` di bawah
 * folder `{user_id}/`, sesuai kebijakan storage "warga unggah ke foldernya
 * sendiri". Mengembalikan PATH (bukan URL publik — bucket privat tidak
 * punya URL publik) untuk disimpan di `service_requests.document_urls` dan
 * ditukar jadi signed URL saat dibaca (lihat `getServiceRequestSignedUrl`).
 */
export async function uploadServiceDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  body: ServiceDocumentBody,
  contentType: string,
): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'application/pdf' ? 'pdf' : 'jpg';
  const suffix = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${suffix}.${ext}`;

  const { error } = await supabase.storage
    .from(SERVICE_DOCS_BUCKET)
    .upload(path, body, { contentType });
  if (error) throw error;

  return path;
}

/**
 * Menukar sebuah path di `service-docs` menjadi signed URL sementara.
 * Ini SATU-SATUNYA cara membaca dokumen privat dari klien — bucket tidak
 * punya URL publik, dan RLS storage hanya mengizinkan pemilik/petugas
 * membaca lewat panggilan API yang membawa sesi mereka (createSignedUrl
 * berjalan atas nama pemanggil, jadi tetap tunduk pada RLS storage).
 */
export async function getServiceRequestSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SERVICE_DOCS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// Service requests (citizen-facing)
// ---------------------------------------------------------------------

export interface ServiceRequestSummary {
  id: string;
  serviceType: CreateServiceRequestInput['serviceType'];
  status: ServiceStatus;
  formData: Record<string, unknown>;
  documentUrls: string[];
  outputPdfUrl: string | null;
  verificationCode: string | null;
  rejectionReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ServiceRequestRow {
  id: string;
  user_id: string;
  service_type: string;
  status: string;
  form_data: unknown;
  document_urls: string[];
  output_pdf_url: string | null;
  verification_code: string | null;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

const SERVICE_REQUEST_COLUMNS =
  'id, user_id, service_type, status, form_data, document_urls, output_pdf_url, ' +
  'verification_code, rejection_reason, created_at, completed_at';

function rowToServiceRequest(row: ServiceRequestRow): ServiceRequestSummary {
  return {
    id: row.id,
    serviceType: row.service_type as CreateServiceRequestInput['serviceType'],
    status: row.status as ServiceStatus,
    formData: (row.form_data as Record<string, unknown>) ?? {},
    documentUrls: row.document_urls,
    outputPdfUrl: row.output_pdf_url,
    verificationCode: row.verification_code,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/**
 * Warga mengajukan permohonan layanan baru. Dokumen harus sudah diunggah
 * lewat `uploadServiceDocument` terlebih dahulu — `documentUrls` di sini
 * berisi path storage, bukan URL publik (bucket privat).
 */
export async function createServiceRequest(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateServiceRequestInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: userId,
      service_type: input.serviceType,
      form_data: input.formData,
      document_urls: input.documentUrls,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/** Permohonan layanan milik warga sendiri, terbaru dulu — layar "Layanan Saya". */
export async function listMyServiceRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ServiceRequestSummary[]> {
  const { data, error } = await supabase
    .from('service_requests')
    .select<string, ServiceRequestRow>(SERVICE_REQUEST_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToServiceRequest);
}

/** Detail satu permohonan layanan — RLS `service_owner_read` membatasi ke pemilik/petugas. */
export async function getServiceRequest(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ServiceRequestSummary> {
  const { data, error } = await supabase
    .from('service_requests')
    .select<string, ServiceRequestRow>(SERVICE_REQUEST_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return rowToServiceRequest(data);
}

// ---------------------------------------------------------------------
// Edge function wrappers
// ---------------------------------------------------------------------

export interface OcrField {
  value: string;
  confidence: number;
}

export interface OcrResponse {
  ok: boolean;
  fields?: Record<string, OcrField>;
  reason?: 'ai_unavailable' | 'low_confidence' | string;
}

/**
 * Memanggil fungsi edge `ocr-doc` untuk mengekstrak field KTP/KK dari sebuah
 * foto (base64). Butuh `supabaseUrl` eksplisit — lihat catatan `askBudget`
 * di queries/budget.ts untuk alasan (paket dipakai lintas app).
 */
export async function runOcr(
  supabaseUrl: string,
  accessToken: string,
  imageBase64: string,
  mimeType: string,
  documentType: 'ktp' | 'kk',
): Promise<OcrResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/ocr-doc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ imageBase64, mimeType, documentType }),
  });
  return response.json() as Promise<OcrResponse>;
}

export interface GenerateServicePdfResponse {
  ok: boolean;
  verificationCode?: string;
  pdfPath?: string;
  reason?: string;
}

/** Memicu fungsi edge `generate-service-pdf` — dipanggil petugas setelah menyetujui permohonan. */
export async function generateServicePdf(
  supabaseUrl: string,
  accessToken: string,
  serviceRequestId: string,
): Promise<GenerateServicePdfResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-service-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ serviceRequestId }),
  });
  return response.json() as Promise<GenerateServicePdfResponse>;
}

// ---------------------------------------------------------------------
// Service requests (staff-facing review)
// ---------------------------------------------------------------------

/**
 * Permohonan layanan untuk ditinjau petugas. RLS `service_owner_read`
 * sudah mengizinkan role petugas membaca seluruh baris, jadi filter di sini
 * murni kenyamanan tampilan (default ke yang masih perlu ditindak).
 */
export async function listServiceRequestsForReview(
  supabase: SupabaseClient<Database>,
  statusFilter?: ServiceStatus,
): Promise<ServiceRequestSummary[]> {
  let query = supabase
    .from('service_requests')
    .select<string, ServiceRequestRow>(SERVICE_REQUEST_COLUMNS)
    .order('created_at', { ascending: true });
  // `ready` HARUS ikut default: begitu PDF terbit statusnya menjadi `ready`,
  // dan halaman /layanan adalah satu-satunya layar petugas — tanpa ini
  // barisnya lenyap dari antrean dan tidak ada lagi cara menandainya
  // `collected` saat warga mengambil suratnya di loket.
  query = statusFilter
    ? query.eq('status', statusFilter)
    : query.in('status', ['submitted', 'verifying', 'signing', 'ready']);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToServiceRequest);
}

/**
 * Transisi status permohonan layanan yang sah. Fungsi murni (tanpa I/O),
 * sepadan dengan `isValidClassificationTransition` untuk aduan.
 *
 * Sebelumnya tidak ada validasi di lapisan mana pun: dropdown petugas
 * menampilkan keenam status sekaligus dan `updateServiceRequestStatus`
 * menulisnya apa adanya, sehingga permohonan yang baru `submitted` bisa
 * langsung diloncatkan ke `ready` — status yang berarti "surat siap
 * diunduh" padahal `output_pdf_url` dan `verification_code` masih NULL,
 * jadi warga melihat "Siap Diunduh" tanpa berkas dan QR-nya tidak
 * memverifikasi apa pun.
 *
 * Setiap status juga memetakan ke dirinya sendiri supaya menyimpan
 * perubahan lain tanpa memindahkan status bukan dianggap transisi tak sah.
 */
const SERVICE_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  submitted: ['submitted', 'verifying', 'rejected'],
  verifying: ['verifying', 'signing', 'rejected'],
  // `ready` dicapai oleh Edge Function generate-service-pdf, bukan dropdown.
  signing: ['signing', 'ready', 'rejected'],
  ready: ['ready', 'collected'],
  collected: ['collected'],
  rejected: ['rejected'],
};

export function isValidServiceTransition(from: ServiceStatus, to: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Status berikutnya yang boleh dipilih petugas dari dropdown. */
export function nextServiceStatuses(from: ServiceStatus): ServiceStatus[] {
  return SERVICE_TRANSITIONS[from] ?? [from];
}

export interface UpdateServiceRequestStatusInput {
  currentStatus: ServiceStatus;
  status: ServiceStatus;
  rejectionReason?: string;
  handledBy: string;
}

/**
 * Petugas memajukan status permohonan (submitted -> verifying -> signing ->
 * ready -> collected, atau -> rejected). RLS `service_staff_update`
 * menegakkan SIAPA yang boleh menulis; validasi di sini mencegah UI
 * mengirim lompatan status yang tidak masuk akal.
 */
export async function updateServiceRequestStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  input: UpdateServiceRequestStatusInput,
): Promise<void> {
  if (!isValidServiceTransition(input.currentStatus, input.status)) {
    throw new Error(`Transisi status tidak valid: ${input.currentStatus} -> ${input.status}`);
  }

  const update: Database['public']['Tables']['service_requests']['Update'] = {
    status: input.status,
    handled_by: input.handledBy,
  };
  // Hanya ditulis saat menolak. Dulu baris ini selalu `?? null`, sehingga
  // setiap perubahan status berikutnya MENGHAPUS alasan penolakan yang
  // sudah terlanjur ditampilkan ke warga.
  if (input.status === 'rejected') {
    update.rejection_reason = input.rejectionReason ?? null;
  }

  const { error } = await supabase.from('service_requests').update(update).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Public verification (QR scan target, no auth)
// ---------------------------------------------------------------------

export interface VerifyServiceDocumentResult {
  valid: boolean;
  serviceType: string | null;
  status: string | null;
  issuedAt: string | null;
}

/**
 * Memanggil RPC publik `verify_service_document` (SECURITY DEFINER, GRANT
 * EXECUTE ke `anon` — lihat 20260811000002_verify_service_document.sql).
 * Sengaja TIDAK mengembalikan form_data/document_urls/user_id — hanya field
 * non-PII yang aman ditampilkan ke siapa pun yang memindai QR.
 */
export async function verifyServiceDocument(
  supabase: SupabaseClient<Database>,
  code: string,
): Promise<VerifyServiceDocumentResult> {
  const { data, error } = await supabase.rpc('verify_service_document', { code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { valid: false, serviceType: null, status: null, issuedAt: null };
  }
  return {
    valid: row.valid,
    serviceType: row.service_type,
    status: row.status,
    issuedAt: row.issued_at,
  };
}
