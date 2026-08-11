/**
 * Logika murni untuk OCR dokumen (ocr-doc): menyusun prompt vision untuk
 * KTP/KK dan memvalidasi/menyaring keluaran model. Tidak ada panggilan
 * jaringan di berkas ini — mudah diuji (lihat ocrParsing.test.ts).
 */

export type DocumentType = 'ktp' | 'kk';

export interface OcrField {
  value: string;
  confidence: number;
}

export type OcrFields = Record<string, OcrField>;

/** Field yang diminta dari model per jenis dokumen, dengan deskripsi singkat untuk prompt. */
const KTP_FIELDS: Record<string, string> = {
  nik: 'Nomor Induk Kependudukan, 16 digit',
  fullName: 'Nama lengkap sesuai KTP',
  birthPlace: 'Tempat lahir',
  birthDate: 'Tanggal lahir, format DD-MM-YYYY',
  gender: 'Jenis kelamin, "LAKI-LAKI" atau "PEREMPUAN"',
  address: 'Alamat jalan/nomor rumah',
  rt: 'Nomor RT',
  rw: 'Nomor RW',
  kelurahan: 'Kelurahan/Desa',
  kecamatan: 'Kecamatan',
  religion: 'Agama',
  maritalStatus: 'Status perkawinan',
  occupation: 'Pekerjaan',
};

const KK_FIELDS: Record<string, string> = {
  nomorKK: 'Nomor Kartu Keluarga, 16 digit',
  kepalaKeluarga: 'Nama kepala keluarga',
  alamat: 'Alamat jalan/nomor rumah',
  rt: 'Nomor RT',
  rw: 'Nomor RW',
  kelurahan: 'Kelurahan/Desa',
  kecamatan: 'Kecamatan',
};

function fieldsFor(documentType: DocumentType): Record<string, string> {
  return documentType === 'ktp' ? KTP_FIELDS : KK_FIELDS;
}

/**
 * Menyusun prompt vision: minta model mengembalikan JSON dengan satu objek
 * `{value, confidence}` per field, confidence 0–1, dan string kosong +
 * confidence 0 untuk field yang tidak terbaca (bukan mengarang nilai).
 */
export function buildOcrPrompt(documentType: DocumentType): string {
  const fields = fieldsFor(documentType);
  const fieldList = Object.entries(fields)
    .map(([key, desc]) => `- "${key}": ${desc}`)
    .join('\n');
  const label = documentType === 'ktp' ? 'KTP (Kartu Tanda Penduduk)' : 'KK (Kartu Keluarga)';

  return `Anda adalah asisten OCR dokumen kependudukan Indonesia. Baca gambar ${label} berikut dan ekstrak field-field ini:
${fieldList}

Kembalikan HANYA objek JSON tanpa markdown, dengan bentuk persis:
{
  "fields": {
    "<nama_field>": { "value": "<teks terbaca>", "confidence": <angka 0 sampai 1> }
  }
}

Aturan:
- Sertakan SEMUA field di atas sebagai key, meski tidak terbaca.
- Jika sebuah field tidak terbaca atau tidak ada di gambar, gunakan value string kosong "" dan confidence 0. JANGAN mengarang nilai.
- confidence merepresentasikan seberapa yakin Anda pada keterbacaan teks tersebut, bukan validitas datanya.`;
}

export interface ParsedOcrResult {
  fields: OcrFields;
  /** Rata-rata confidence di antara field yang punya value non-kosong. */
  overallConfidence: number;
}

/**
 * Ambang bawah rata-rata confidence untuk dianggap "cukup andal untuk
 * auto-fill". Di bawah ini, ocr-doc masih mengembalikan field (agar warga
 * bisa lihat & koreksi manual) tapi dengan `ok: false, reason: 'low_confidence'`
 * sehingga UI tahu untuk menampilkan peringatan alih-alih diam-diam mengisi
 * formulir dengan data yang mungkin salah baca. 0.5 dipilih karena di bawah
 * itu OCR pada foto HP (blur/miring/silau) secara empiris lebih sering salah
 * baca daripada benar untuk field alfanumerik seperti NIK.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** Mem-parsing dan memvalidasi keluaran mentah model terhadap katalog field yang diminta. */
export function parseOcrResponse(raw: string, documentType: DocumentType): ParsedOcrResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Respons model bukan JSON yang valid');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Respons model bukan objek JSON');
  }

  const rawFields = (parsed as Record<string, unknown>).fields;
  if (typeof rawFields !== 'object' || rawFields === null) {
    throw new Error('Respons model tidak memiliki objek "fields"');
  }

  const expected = fieldsFor(documentType);
  const result: OcrFields = {};
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const key of Object.keys(expected)) {
    const raw = (rawFields as Record<string, unknown>)[key];
    let value = '';
    let confidence = 0;
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      value = typeof r.value === 'string' ? r.value.trim() : '';
      const c = typeof r.confidence === 'number' ? r.confidence : 0;
      confidence = Math.min(1, Math.max(0, Number.isFinite(c) ? c : 0));
    }
    result[key] = { value, confidence };
    if (value) {
      confidenceSum += confidence;
      confidenceCount += 1;
    }
  }

  const overallConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
  return { fields: result, overallConfidence };
}

/** true jika hasil OCR terlalu tidak yakin untuk auto-fill formulir tanpa peringatan. */
export function isLowConfidence(result: ParsedOcrResult): boolean {
  return result.overallConfidence < LOW_CONFIDENCE_THRESHOLD;
}
