import { hashCode } from "../_shared/otp.ts";
import { verifyRefreshToken } from "../_shared/jwt.ts";
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
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  let body: { refreshToken?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" }, 400);
  }

  const refreshToken = body.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_request" }, 400);
  }

  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return jsonResponse({ ok: false, reason: "session_expired" }, 401);
  }

  const userId = payload.sub;
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase.from("auth_sessions").update({
      revoked_at: nowIso,
      revoked_reason: "signout",
    }).eq("user_id", userId).is("revoked_at", null);

    if (error) {
      console.error("signout all error", error);
      return jsonResponse({ ok: false, reason: "server_error" }, 500);
    }
  } else {
    const refreshHash = await hashCode(refreshToken, pepper);
    const { error } = await supabase.from("auth_sessions").update({
      revoked_at: nowIso,
      revoked_reason: "signout",
    }).eq("refresh_token_hash", refreshHash).is("revoked_at", null);

    if (error) {
      console.error("signout single error", error);
      return jsonResponse({ ok: false, reason: "server_error" }, 500);
    }
  }

  return jsonResponse({ ok: true });
});
