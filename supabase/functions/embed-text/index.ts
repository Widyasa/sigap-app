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

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    await verifyAccessToken(token);
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  try {
    const embedding = await computeEmbedding(text);

    const supabase = getServiceClient();
    const table = TARGET_TABLE[target as EmbeddingTarget];
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
