import { hashCode } from "../_shared/otp.ts";
import { createAccessToken, createRefreshToken } from "../_shared/jwt.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { verifyPassword } from "../_shared/password.ts";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" });
  }

  const rawEmail = body.email;
  const rawPassword = body.password;
  if (
    !rawEmail || !rawPassword || typeof rawEmail !== "string" ||
    typeof rawPassword !== "string"
  ) {
    return jsonResponse({ ok: false, reason: "invalid_request" });
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email) || rawPassword.length < 8) {
    return jsonResponse({ ok: false, reason: "invalid_credentials" });
  }

  const pepper = Deno.env.get("PASSWORD_PEPPER") ?? Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();
  const ip = getRequesterIp(req);

  // Opportunistic cleanup (1:20 chance), matching auth-request-otp pattern.
  if (Math.random() < 0.05) {
    try {
      await supabase.rpc("purge_expired_password_attempts");
    } catch {
      // Ignore cleanup failures; they are not fatal to the request.
    }
  }

  const { data: limitData, error: limitError } = await supabase.rpc(
    "check_password_rate_limit",
    { p_email: email, p_ip: ip },
  );

  if (limitError) {
    console.error("password rate limit rpc error", limitError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const limit = Array.isArray(limitData) ? limitData[0] : limitData;
  if (!limit?.allowed) {
    return jsonResponse({
      ok: false,
      reason: "too_many_attempts",
      retry_after_seconds: limit?.retry_after_seconds ?? 900,
    });
  }

  // Look up user with profile. Password login is only allowed for non-citizen roles.
  const { data: userRows, error: userError } = await supabase
    .from("users")
    .select("id, disabled_at, password_hash, profiles(role)")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    console.error("password login user lookup error", userError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const profile = Array.isArray(userRows?.profiles)
    ? userRows.profiles[0]
    : userRows?.profiles as { role: string } | null;

  const validUser = !!userRows && !!userRows.password_hash && profile &&
    profile.role !== "citizen";

  let passwordValid = false;
  if (validUser) {
    passwordValid = await verifyPassword(rawPassword, userRows.password_hash, pepper);
  }

  // Log attempt regardless of user existence; the count is used for rate limiting.
  try {
    await supabase.rpc("log_password_attempt", {
      p_email: email,
      p_ip: ip,
      p_success: passwordValid,
    });
  } catch (e) {
    console.error("log_password_attempt error", e);
  }

  if (!passwordValid || userRows?.disabled_at) {
    // Return the same generic reason so disabled accounts and wrong credentials
    // cannot be distinguished by callers.
    return jsonResponse({ ok: false, reason: "invalid_credentials" });
  }

  const userId = userRows.id;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profileRow) {
    console.error("password login profile lookup error", profileError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const refreshToken = createRefreshToken();
  const refreshHash = await hashCode(refreshToken, pepper);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error: sessionError } = await supabase.from("auth_sessions").insert({
    user_id: userId,
    refresh_token_hash: refreshHash,
    expires_at: sessionExpiresAt,
  });

  if (sessionError) {
    console.error("password login session insert error", sessionError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const accessToken = await createAccessToken(userId);

  return jsonResponse({
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: userId,
      email,
      profile: {
        fullName: profileRow.full_name,
        role: profileRow.role,
        dinasId: profileRow.dinas_id,
        kelurahan: profileRow.kelurahan,
        kecamatan: profileRow.kecamatan,
        rw: profileRow.rw,
      },
    },
  });
});
