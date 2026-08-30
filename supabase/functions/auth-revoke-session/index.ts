import { verifyAccessToken } from "../_shared/jwt.ts";
import { getServiceClient } from "../_shared/supabase.ts";

function corsHeaders(origin = "*"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  let payload;
  try {
    payload = await verifyAccessToken(accessToken);
  } catch {
    return jsonResponse({ ok: false, reason: "session_expired" });
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" });
  }

  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_request" });
  }

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  // Pastikan sesi benar-benar milik pemanggil dan masih aktif.
  const { data: rows, error: findError } = await supabase
    .from("auth_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", payload.sub)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1);

  if (findError || !rows || rows.length === 0) {
    return jsonResponse({ ok: false, reason: "not_found" });
  }

  const { error } = await supabase.from("auth_sessions").update({
    revoked_at: nowIso,
    revoked_reason: "single_revoke",
  }).eq("id", sessionId);

  if (error) {
    console.error("revoke session error", error);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
