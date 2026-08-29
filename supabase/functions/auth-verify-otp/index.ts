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

  // Klaim satu percobaan secara ATOMIK. Pola baca-ubah-tulis sebelumnya
  // membuat batas OTP_MAX_ATTEMPTS hanya berlaku untuk percobaan berurutan:
  // permintaan paralel sama-sama membaca `attempts` yang lama, jadi ribuan
  // tebakan serentak terhadap satu kode tidak pernah memicu penguncian.
  // Lihat migrasi 20260816000003_otp_atomic_attempts.sql.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "claim_otp_attempt",
    { p_email: email },
  );

  if (claimError) {
    console.error("claim otp attempt error", claimError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const row = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!row) {
    return jsonResponse({ ok: false, reason: "invalid_code" }, 401);
  }

  // `row.attempts` sudah berisi nilai SESUDAH kenaikan, dan percobaan
  // ke-OTP_MAX_ATTEMPTS ini sendiri masih sah — jadi kode tetap diperiksa
  // dulu, baru kehabisan kuota dilaporkan kalau kodenya memang salah.
  const valid = await verifyCode(rawCode, row.code_hash, pepper);
  if (!valid) {
    return jsonResponse(
      {
        ok: false,
        reason: row.attempts >= OTP_MAX_ATTEMPTS
          ? "too_many_attempts"
          : "invalid_code",
      },
      401,
    );
  }

  await supabase.from("auth_otp_codes").update({ consumed_at: nowIso }).eq(
    "id",
    row.otp_id,
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

  const accessToken = await createAccessToken(
    userId,
    {
      role: profile.role,
      dinas_id: profile.dinas_id,
      kelurahan: profile.kelurahan,
      kecamatan: profile.kecamatan,
    },
    email,
  );

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
        rw: profile.rw,
      },
    },
  });
});
