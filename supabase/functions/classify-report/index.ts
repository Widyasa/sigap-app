import { verifyAccessToken } from '../_shared/jwt.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { buildClassificationPrompt } from '../_shared/prompts.ts';
import { callGeminiJson } from '../_shared/gemini.ts';
import { computeEmbedding } from '../_shared/embedding.ts';
import {
  parseClassification,
  computeSlaDueAt,
  type Classification,
  type DinasRow,
} from '../_shared/classification.ts';

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

interface DuplicateRow {
  id: string;
  title: string | null;
  similarity: number;
  distance_meters: number;
  upvote_count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { complaintId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_body' }, 400);
  }

  const complaintId = body.complaintId;
  if (!complaintId || typeof complaintId !== 'string') {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let callerId: string;
  try {
    const payload = await verifyAccessToken(token);
    callerId = payload.sub;
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  const supabase = getServiceClient();

  const { data: complaint, error: complaintError } = await supabase
    .from('complaints')
    .select(
      'id, user_id, description, location_lat, location_lng, status, title, category, assigned_dinas, urgency, ai_summary, ai_confidence',
    )
    .eq('id', complaintId)
    .single();

  if (complaintError || !complaint) {
    return jsonResponse({ ok: false, reason: 'not_found' }, 404);
  }
  if (complaint.user_id !== callerId) {
    return jsonResponse({ ok: false, reason: 'forbidden' }, 403);
  }

  // Idempoten: sudah diklasifikasi sebelumnya, jangan panggil AI lagi.
  if (complaint.status !== 'pending_classification') {
    if (
      complaint.title &&
      complaint.category &&
      complaint.assigned_dinas &&
      complaint.urgency &&
      complaint.ai_summary &&
      complaint.ai_confidence !== null
    ) {
      return jsonResponse({
        ok: true,
        classification: {
          title: complaint.title,
          category: complaint.category,
          assignedDinas: complaint.assigned_dinas,
          urgency: complaint.urgency,
          summary: complaint.ai_summary,
          confidence: complaint.ai_confidence,
        } satisfies Classification,
        duplicates: [],
      });
    }
    return jsonResponse({ ok: false, reason: 'already_classified' }, 200);
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not set');
    // Klasifikasi adalah tugas terstruktur ringan — pakai model "lite" bila
    // ada agar tetap di bawah target 5 detik (AC1); fallback ke model utama.
    const geminiModel = Deno.env.get('GEMINI_MODEL_LIGHT') ?? Deno.env.get('GEMINI_MODEL');
    if (!geminiModel) throw new Error('GEMINI_MODEL(_LIGHT) is not set');

    const { data: dinasRows, error: dinasError } = await supabase
      .from('dinas')
      .select('id, name, categories, sla_hours_p0, sla_hours_p1, sla_hours_p2');
    if (dinasError || !dinasRows || dinasRows.length === 0) {
      throw new Error('Gagal memuat katalog dinas');
    }
    const dinasList: DinasRow[] = (
      dinasRows as Array<{
        id: string;
        name: string;
        categories: string[];
        sla_hours_p0: number;
        sla_hours_p1: number;
        sla_hours_p2: number;
      }>
    ).map((d) => ({
      id: d.id,
      name: d.name,
      categories: d.categories,
      slaHoursP0: d.sla_hours_p0,
      slaHoursP1: d.sla_hours_p1,
      slaHoursP2: d.sla_hours_p2,
    }));

    const prompt = buildClassificationPrompt(complaint.description, dinasList);
    const raw = await callGeminiJson(prompt, geminiApiKey, geminiModel);
    const classification = parseClassification(raw, dinasList);
    const dinas = dinasList.find((d) => d.id === classification.assignedDinas)!;
    const slaDueAt = computeSlaDueAt(dinas, classification.urgency);

    const embedding = await computeEmbedding(complaint.description);

    // Deteksi duplikat SEBELUM menulis embedding aduan ini sendiri, agar
    // aduan ini tidak bisa cocok dengan dirinya sendiri.
    const { data: duplicateRows } = await supabase.rpc('find_duplicate_complaints', {
      query_embedding: embedding,
      query_lat: complaint.location_lat,
      query_lng: complaint.location_lng,
    });
    const duplicates = ((duplicateRows ?? []) as DuplicateRow[]).map((d) => ({
      id: d.id,
      title: d.title ?? '',
      similarity: d.similarity,
      distanceMeters: d.distance_meters,
      upvoteCount: d.upvote_count,
    }));

    const { error: updateError } = await supabase
      .from('complaints')
      .update({
        title: classification.title,
        category: classification.category,
        assigned_dinas: classification.assignedDinas,
        urgency: classification.urgency,
        ai_summary: classification.summary,
        ai_confidence: classification.confidence,
        embedding: embedding as unknown as string,
        sla_due_at: slaDueAt.toISOString(),
        status: 'pending',
      })
      .eq('id', complaintId)
      .eq('status', 'pending_classification');
    if (updateError) throw updateError;

    return jsonResponse({ ok: true, classification, duplicates });
  } catch (e) {
    console.error('classify-report error', e);
    return jsonResponse({ ok: false, reason: 'ai_unavailable' }, 200);
  }
});
