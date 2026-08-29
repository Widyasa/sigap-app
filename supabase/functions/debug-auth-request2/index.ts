import { generateCode, hashCode } from "../_shared/otp.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const OTP_TTL_MS = 10 * 60 * 1000;

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(), ...extraHeaders },
  });
}

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function getRequesterIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && isValidIp(last)) return last;
  }
  return "127.0.0.1";
}
function isValidIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (req.method !== "POST") return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);

    let body: { email?: string };
    try { body = await req.json(); } catch { return jsonResponse({ ok: false, reason: "invalid_body" }, 400); }
    const rawEmail = body.email;
    if (!rawEmail || typeof rawEmail !== "string") return jsonResponse({ ok: false, reason: "invalid_email" }, 400);
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) return jsonResponse({ ok: false, reason: "invalid_email" }, 400);

    const pepper = Deno.env.get("OTP_PEPPER");
    if (!pepper) return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);

    const supabase = getServiceClient();
    const ip = getRequesterIp(req);

    if (Math.random() < 0.05) {
      try { await supabase.rpc("purge_expired_auth_rows"); } catch {}
    }

    const { data: limitData, error: limitError } = await supabase.rpc("check_otp_rate_limit", { p_email: email, p_ip: ip });
    if (limitError) return jsonResponse({ ok: false, reason: "rate_limit_error", error: limitError.message }, 500);

    const limit = Array.isArray(limitData) ? limitData[0] : limitData;
    if (!limit?.allowed) return jsonResponse({ ok: false, reason: "rate_limited" }, 429);

    const code = generateCode();
    const codeHash = await hashCode(code, pepper);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: invalidateError } = await supabase.from("auth_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("email", email).is("consumed_at", null);
    if (invalidateError) return jsonResponse({ ok: false, reason: "invalidate_error", error: invalidateError.message }, 500);

    const { data: insertData, error: insertError } = await supabase.from("auth_otp_codes").insert({ email, code_hash: codeHash, requester_ip: ip, expires_at: expiresAt }).select("id").single();
    if (insertError || !insertData) return jsonResponse({ ok: false, reason: "insert_error", error: insertError?.message }, 500);

    const isDev = /^(1|true|yes)$/.test(Deno.env.get("OTP_DEV_MODE") ?? "");
    return jsonResponse({ ok: true, devCode: code, isDev, ip });
  } catch (err) {
    return jsonResponse({ ok: false, reason: "uncaught", error: String(err), stack: err instanceof Error ? err.stack : undefined }, 500);
  }
});
