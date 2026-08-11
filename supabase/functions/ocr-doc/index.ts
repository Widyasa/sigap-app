import { verifyAccessToken } from '../_shared/jwt.ts';
import { callGeminiVisionJson } from '../_shared/gemini.ts';
import {
  buildOcrPrompt,
  parseOcrResponse,
  isLowConfidence,
  type DocumentType,
} from '../_shared/ocrParsing.ts';

function corsHeaders(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

const DOCUMENT_TYPES: readonly DocumentType[] = ['ktp', 'kk'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

interface OcrRequestBody {
  imageBase64?: string;
  mimeType?: string;
  documentType?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_body' }, 400);
  }

  const { imageBase64, mimeType, documentType } = body;
  if (
    !imageBase64 || typeof imageBase64 !== 'string' ||
    !mimeType || !ALLOWED_MIME_TYPES.includes(mimeType) ||
    !documentType || !DOCUMENT_TYPES.includes(documentType as DocumentType)
  ) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    await verifyAccessToken(token);
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  // gemini-flash-lite-latest terverifikasi menerima inlineData gambar dan
  // cukup untuk ekstraksi field terstruktur (lihat catatan implementasi
  // callGeminiVisionJson) — lebih murah/cepat daripada model penuh untuk
  // beban kerja per-unggahan dokumen ini.
  const model = Deno.env.get('GEMINI_MODEL_LIGHT') ?? Deno.env.get('GEMINI_MODEL');
  if (!apiKey || !model) {
    return jsonResponse({ ok: false, reason: 'ai_unavailable' }, 200);
  }

  try {
    const prompt = buildOcrPrompt(documentType as DocumentType);
    const raw = await callGeminiVisionJson(prompt, imageBase64, mimeType, apiKey, model);
    const result = parseOcrResponse(raw, documentType as DocumentType);

    if (isLowConfidence(result)) {
      return jsonResponse({ ok: false, reason: 'low_confidence', fields: result.fields }, 200);
    }

    return jsonResponse({ ok: true, fields: result.fields }, 200);
  } catch (e) {
    console.error('ocr-doc error', e);
    return jsonResponse({ ok: false, reason: 'ai_unavailable' }, 200);
  }
});
