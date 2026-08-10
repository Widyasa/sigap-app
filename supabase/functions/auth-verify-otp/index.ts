import { hashCode, verifyCode } from "../_shared/otp.ts";
import { createAccessToken, createRefreshToken } from "../_shared/jwt.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const OTP_MAX_ATTEMPTS = 5;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" }, 400);
  }

  const rawEmail = body.email;
  const rawCode = body.code;
  if (!rawEmail || !rawCode || typeof rawEmail !== "string" ||
    typeof rawCode !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_request" }, 400);
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email) || !/^\d{6}$/.test(rawCode)) {
    return jsonResponse({ ok: false, reason: "invalid_code" }, 400);
  }

  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error: findError } = await supabase
    .from("auth_otp_codes")
    .select("*")
    .eq("email", email)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (findError) {
    console.error("find otp error", findError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const row = rows?.[0];
  if (!row) {
    return jsonResponse({ ok: false, reason: "invalid_code" }, 401);
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await supabase.from("auth_otp_codes").update({ consumed_at: nowIso }).eq(
      "id",
      row.id,
    );
    return jsonResponse({ ok: false, reason: "too_many_attempts" }, 429);
  }

  const valid = await verifyCode(rawCode, row.code_hash, pepper);
  if (!valid) {
    const nextAttempts = row.attempts + 1;
    const update: Record<string, unknown> = { attempts: nextAttempts };
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      update.consumed_at = nowIso;
    }
    await supabase.from("auth_otp_codes").update(update).eq("id", row.id);
    return jsonResponse(
      {
        ok: false,
        reason: nextAttempts >= OTP_MAX_ATTEMPTS
          ? "too_many_attempts"
          : "invalid_code",
      },
      401,
    );
  }

  await supabase.from("auth_otp_codes").update({ consumed_at: nowIso }).eq(
    "id",
    row.id,
  );

  const { data: userRows, error: userError } = await supabase.rpc(
    "find_or_create_user",
    { p_email: email },
  );

  if (userError || !userRows || userRows.length === 0) {
    console.error("find_or_create_user error", userError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const { user_id: userId, is_disabled: isDisabled } = userRows[0];
  if (isDisabled) {
    return jsonResponse({ ok: false, reason: "account_disabled" }, 403);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("profile lookup error", profileError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const refreshToken = await createRefreshToken(userId);
  const refreshHash = await hashCode(refreshToken, pepper);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error: sessionError } = await supabase.from("auth_sessions").insert({
    user_id: userId,
    refresh_token_hash: refreshHash,
    expires_at: sessionExpiresAt,
  });

  if (sessionError) {
    console.error("session insert error", sessionError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const accessToken = await createAccessToken(userId, {
    role: profile.role,
    dinas_id: profile.dinas_id,
    kelurahan: profile.kelurahan,
    kecamatan: profile.kecamatan,
  });

  return jsonResponse({
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: userId,
      email,
      profile: {
        fullName: profile.full_name,
        role: profile.role,
        dinasId: profile.dinas_id,
        kelurahan: profile.kelurahan,
        kecamatan: profile.kecamatan,
      },
    },
  });
});
