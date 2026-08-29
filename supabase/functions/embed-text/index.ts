import { verifyAccessToken } from '../_shared/jwt.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { computeEmbedding } from '../_shared/embedding.ts';

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

type EmbeddingTarget = 'complaint' | 'aspiration' | 'budget';

const TARGET_TABLE: Record<EmbeddingTarget, string> = {
  complaint: 'complaints',
  aspiration: 'aspirations',
  budget: 'budget_items',
};

const MAX_TEXT_LENGTH = 5_000;

/**
 * `complaint`/`aspiration`: hanya pemilik barisnya. `budget`: hanya admin —
 * `budget_items` di-RLS sebagai tulis-admin (`budget_admin_write`), dan
 * pengindeksan ulang memang dipicu dari dashboard admin `/anggaran`.
 */
async function isAuthorizedForTarget(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  target: EmbeddingTarget,
  id: string,
  payload: { sub?: string; app_role?: string },
): Promise<boolean> {
  if (target === 'budget') return payload.app_role === 'admin';
  if (payload.app_role === 'admin') return true;
  if (!payload.sub) return false;

  const { data, error } = await supabase
    .from(TARGET_TABLE[target])
    .select('user_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return false;
  return data.user_id === payload.sub;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { text?: string; target?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_body' }, 400);
  }

  const { text, target, id } = body;
  if (
    !text || typeof text !== 'string' ||
    !id || typeof id !== 'string' ||
    (target !== 'complaint' && target !== 'aspiration' && target !== 'budget')
  ) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  // Batas panjang: fungsi ini memanggil penyedia embedding berbayar dengan
  // teks bebas dari pemanggil. Tanpa batas, satu akun bisa menghabiskan
  // kuota AI proyek dalam satu gelung.
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ ok: false, reason: 'text_too_long' }, 413);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  const supabase = getServiceClient();
  const table = TARGET_TABLE[target as EmbeddingTarget];

  // Otorisasi per baris. Sebelumnya fungsi ini hanya memastikan pemanggil
  // punya sesi yang sah, lalu menulis lewat service role — yang MELEWATI
  // RLS — ke baris mana pun yang id-nya dikirim pemanggil. Artinya warga
  // biasa bisa menimpa embedding `budget_items` (tabel tulis-admin) dan
  // dengan begitu mengarahkan hasil pencarian semantik "Tanya AI" ke
  // program yang salah, atau meracuni `find_duplicate_complaints` supaya
  // aduan baru yang sah otomatis ditandai duplikat.
  const authorized = await isAuthorizedForTarget(supabase, target, id, payload);
  if (!authorized) {
    return jsonResponse({ ok: false, reason: 'forbidden' }, 403);
  }

  try {
    const embedding = await computeEmbedding(text);

    const { error } = await supabase
      .from(table)
      .update({ embedding: embedding as unknown as string })
      .eq('id', id);
    if (error) throw error;

    return jsonResponse({ ok: true, dimensions: 384 });
  } catch (e) {
    console.error('embed-text error', e);
    return jsonResponse({ ok: false, reason: 'ai_unavailable' }, 200);
  }
});
