import { generateCode, hashCode } from "../_shared/otp.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

/**
 * IP pemanggil untuk `check_otp_rate_limit`.
 *
 * Entri PALING KIRI di `X-Forwarded-For` berasal dari klien dan bisa diisi
 * apa saja; memakainya berarti penyerang cukup mengganti header setiap
 * permintaan agar batas 10/jam per-IP tidak pernah tercapai — dan lewat
 * situ mengirimi alamat email korban mana pun sebanyak-banyaknya lewat akun
 * Resend kita. Entri PALING KANAN adalah yang ditambahkan proxy terdekat
 * dan tidak bisa dipalsukan klien.
 */
function getRequesterIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && isValidIp(last)) return last;
  }
  return "127.0.0.1";
}

/** `requester_ip` bertipe INET; nilai yang tidak valid membuat INSERT 500. */
function isValidIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value);
}

async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;

  const from = Deno.env.get("EMAIL_FROM") ?? "SIGAP <otp@sigap.id>";
  const subject = `Kode OTP SIGAP Anda: ${code}`;
  const html = `<p>Halo,</p>
<p>Kode verifikasi masuk aplikasi SIGAP Anda adalah:</p>
<p style="font-size:24px; font-weight:bold; letter-spacing:2px;">${code}</p>
<p>Kode berlaku 10 menit dan bersifat rahasia. Jangan bagikan kepada siapa pun, termasuk petugas SIGAP.</p>
<p>--<br>Tim SIGAP<br>Kota Bandung</p>`;
  const text = `Halo,\n\nKode verifikasi masuk aplikasi SIGAP Anda adalah: ${code}\n\nKode berlaku 10 menit dan bersifat rahasia. Jangan bagikan kepada siapa pun, termasuk petugas SIGAP.\n\n--\nTim SIGAP\nKota Bandung`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
    }),
  });

  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" });
  }

  const rawEmail = body.email;
  if (!rawEmail || typeof rawEmail !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_email" });
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, reason: "invalid_email" });
  }

  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const ip = getRequesterIp(req);

  // Opportunistic cleanup (1:20 chance) per PRD.
  if (Math.random() < 0.05) {
    try {
      await supabase.rpc("purge_expired_auth_rows");
    } catch {
      // Ignore cleanup failures; they are not fatal to the request.
    }
  }

  const { data: limitData, error: limitError } = await supabase.rpc(
    "check_otp_rate_limit",
    { p_email: email, p_ip: ip },
  );

  if (limitError) {
    console.error("rate limit rpc error", limitError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const limit = Array.isArray(limitData) ? limitData[0] : limitData;
  if (!limit?.allowed) {
    return jsonResponse({
      ok: false,
      reason: limit?.reason === "too_many_for_email" ||
          limit?.reason === "too_many_for_ip"
        ? "too_many_attempts"
        : "rate_limited",
      retry_after_seconds: limit?.retry_after_seconds ?? 0,
    });
  }

  const code = generateCode();
  const codeHash = await hashCode(code, pepper);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Indeks parsial `auth_otp_one_active_idx` (20260810000002_identity.sql)
  // memaksa maksimal SATU baris per email selama `consumed_at IS NULL`, dan
  // kedaluwarsa TIDAK mengisi `consumed_at`. Tanpa pembatalan eksplisit di
  // bawah, permintaan kode kedua untuk alamat yang sama melanggar indeks itu
  // (23505), tertelan menjadi `server_error`, dan alamat tersebut TIDAK BISA
  // login lagi sampai barisnya dipanen `purge_expired_auth_rows` — yang baru
  // menghapus setelah lewat sehari dan hanya dengan peluang 1:20 per
  // permintaan. Artinya: "kirim ulang kode" rusak untuk semua orang, dan
  // siapa pun yang tahu email petugas bisa mengunci akun itu dari dashboard.
  const { error: invalidateError } = await supabase
    .from("auth_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .is("consumed_at", null);

  if (invalidateError) {
    console.error("invalidate previous otp error", invalidateError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const { data: insertData, error: insertError } = await supabase
    .from("auth_otp_codes")
    .insert({
      email,
      code_hash: codeHash,
      requester_ip: ip,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertError || !insertData) {
    console.error("insert otp error", insertError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  const isDev = /^(1|true|yes)$/.test(Deno.env.get("OTP_DEV_MODE") ?? "");
  if (isDev) {
    return jsonResponse({ ok: true, devCode: code });
  }

  const sent = await sendOtpEmail(email, code);
  if (!sent) {
    // Kegagalan email membuat kode tidak dapat dipakai, tetapi barisnya
    // tetap dipertahankan dan ditandai sebagai sudah dikonsumsi.
    await supabase.from("auth_otp_codes").update({ consumed_at: nowIso }).eq(
      "id",
      insertData.id,
    );
    return jsonResponse({ ok: false, reason: "email_failed" });
  }

  return jsonResponse({ ok: true });
});
