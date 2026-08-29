import { hashCode } from "../_shared/otp.ts";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../_shared/jwt.ts";
import { getServiceClient } from "../_shared/supabase.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  let body: { refreshToken?: string };
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

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const refreshHash = await hashCode(refreshToken, pepper);

  const { data: rows, error: findError } = await supabase
    .from("auth_sessions")
    .select("*")
    .eq("refresh_token_hash", refreshHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1);

  if (findError || !rows || rows.length === 0) {
    // Deteksi pemakaian ulang: kalau hash-nya ADA tapi sudah dicabut karena
    // rotasi, artinya token lama dipakai untuk kedua kalinya — entah oleh
    // penyerang yang mencurinya, entah oleh perangkat sah yang tokennya
    // dicuri. Keduanya berarti satu keluarga sesi tidak lagi tepercaya,
    // jadi seluruh sesi pengguna itu dicabut. Kolom `revoked_reason`
    // memang sudah menyediakan nilai 'reuse_detected' sejak
    // 20260810000002_identity.sql, tapi sebelumnya tidak pernah ditulis.
    const { data: reused } = await supabase
      .from("auth_sessions")
      .select("user_id")
      .eq("refresh_token_hash", refreshHash)
      .not("revoked_at", "is", null)
      .limit(1);

    if (reused && reused.length > 0) {
      console.error("refresh token reuse detected", { userId: reused[0].user_id });
      await supabase.from("auth_sessions").update({
        revoked_at: nowIso,
        revoked_reason: "reuse_detected",
      }).eq("user_id", reused[0].user_id).is("revoked_at", null);
    }
    return jsonResponse({ ok: false, reason: "session_expired" }, 401);
  }

  const session = rows[0];

  // Akun yang dinonaktifkan admin harus langsung kehilangan aksesnya.
  // `disabled_at` sebelumnya hanya diperiksa di auth-verify-otp, padahal
  // perangkat yang sudah masuk tidak pernah mengulang OTP — ia cukup
  // merotasi refresh token setiap jam, sehingga operator yang sudah
  // dinonaktifkan tetap memegang akses sampai SESSION_TTL 30 hari habis.
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("disabled_at, email")
    .eq("id", session.user_id)
    .single();

  if (userError || !userRow) {
    console.error("user lookup error", userError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  if (userRow.disabled_at) {
    await supabase.from("auth_sessions").update({
      revoked_at: nowIso,
      revoked_reason: "account_disabled",
    }).eq("user_id", session.user_id).is("revoked_at", null);
    return jsonResponse({ ok: false, reason: "account_disabled" }, 403);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user_id)
    .single();

  if (profileError || !profile) {
    console.error("profile lookup error", profileError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const newRefreshToken = await createRefreshToken(session.user_id);
  const newRefreshHash = await hashCode(newRefreshToken, pepper);
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Revoke the old refresh token and insert the new one.
  const { error: revokeError } = await supabase.from("auth_sessions").update({
    revoked_at: nowIso,
    revoked_reason: "rotated",
  }).eq("refresh_token_hash", refreshHash);

  if (revokeError) {
    console.error("revoke session error", revokeError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const { error: insertError } = await supabase.from("auth_sessions").insert({
    user_id: session.user_id,
    refresh_token_hash: newRefreshHash,
    expires_at: sessionExpiresAt,
  });

  if (insertError) {
    console.error("rotate session insert error", insertError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const accessToken = await createAccessToken(
    session.user_id,
    {
      role: profile.role,
      dinas_id: profile.dinas_id,
      kelurahan: profile.kelurahan,
      kecamatan: profile.kecamatan,
    },
    userRow.email as string | undefined,
  );

  return jsonResponse({ ok: true, accessToken, refreshToken: newRefreshToken });
});
