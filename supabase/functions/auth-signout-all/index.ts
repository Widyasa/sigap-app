import { hashCode } from "../_shared/otp.ts";
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

  let body: { refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" });
  }

  const refreshToken = body.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_request" });
  }

  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  // Verifikasi refresh token dengan mencocokkan hash-nya di database,
  // sama seperti auth-refresh. Kita TIDAK punya verifyRefreshToken JWT
  // karena refresh token adalah opaque hex.
  const refreshHash = await hashCode(refreshToken, pepper);
  const { data: rows, error: findError } = await supabase
    .from("auth_sessions")
    .select("user_id")
    .eq("refresh_token_hash", refreshHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1);

  if (findError || !rows || rows.length === 0) {
    return jsonResponse({ ok: false, reason: "session_expired" });
  }

  const userId = rows[0].user_id;

  // Cabut SEMUA sesi pengguna kecuali sesi yang membawa refresh token ini.
  const { error } = await supabase.from("auth_sessions").update({
    revoked_at: nowIso,
    revoked_reason: "signout_all",
  }).eq("user_id", userId)
    .is("revoked_at", null)
    .neq("refresh_token_hash", refreshHash);

  if (error) {
    console.error("signout all error", error);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
