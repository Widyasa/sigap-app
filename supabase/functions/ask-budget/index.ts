import { verifyAccessToken } from '../_shared/jwt.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callGeminiJson } from '../_shared/gemini.ts';
import { computeEmbedding } from '../_shared/embedding.ts';
import { buildBudgetRagPrompt, parseBudgetRagResponse, type BudgetRagItem } from '../_shared/budgetRag.ts';

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

interface SearchBudgetItemRow {
  id: string;
  program_name: string;
  activity_name: string | null;
  dinas_id: string;
  budget_allocated: number;
  budget_realized: number;
  kelurahan: string | null;
  progress_percent: number;
  similarity: number;
}

const MATCH_COUNT = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_body' }, 400);
  }

  const question = body.question;
  if (!question || typeof question !== 'string' || !question.trim()) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    await verifyAccessToken(token);
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  const supabase = getServiceClient();

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const geminiModel = Deno.env.get('GEMINI_MODEL_LIGHT') ?? Deno.env.get('GEMINI_MODEL');
  if (!geminiApiKey || !geminiModel) {
    return jsonResponse({ ok: false, reason: 'config_error' }, 500);
  }

  try {
    const questionEmbedding = await computeEmbedding(question);

    const { data: matchRows, error: searchError } = await supabase.rpc('search_budget_items', {
      query_embedding: questionEmbedding as unknown as string,
      match_count: MATCH_COUNT,
    });
    if (searchError) throw searchError;

    const rows = (matchRows ?? []) as SearchBudgetItemRow[];
    if (rows.length === 0) {
      return jsonResponse({ ok: false, reason: 'no_data' });
    }

    const items: BudgetRagItem[] = rows.map((r) => ({
      id: r.id,
      programName: r.program_name,
      activityName: r.activity_name,
      dinasId: r.dinas_id,
      budgetAllocated: r.budget_allocated,
      budgetRealized: r.budget_realized,
      kelurahan: r.kelurahan,
      progressPercent: r.progress_percent,
    }));

    // Jawaban RAG adalah tugas terstruktur ringan — pakai model "lite" bila
    // ada agar tetap cepat, sama seperti classify-report.
    const prompt = buildBudgetRagPrompt(question, items);
    const raw = await callGeminiJson(prompt, geminiApiKey, geminiModel);

    const validItemIds = items.map((it) => it.id);
    const parsed = parseBudgetRagResponse(raw, validItemIds);

    const itemById = new Map(items.map((it) => [it.id, it]));
    const citedItems = parsed.citedItemIds
      .map((id) => itemById.get(id))
      .filter((it): it is BudgetRagItem => it !== undefined)
      .map((it) => ({ id: it.id, programName: it.programName, dinasId: it.dinasId }));

    return jsonResponse({ ok: true, answer: parsed.answer, citedItems });
  } catch (e) {
    console.error('ask-budget error', e);
    return jsonResponse({ ok: false, reason: 'ai_unavailable' }, 200);
  }
});
