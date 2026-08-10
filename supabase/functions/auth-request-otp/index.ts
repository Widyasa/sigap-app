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

function getRequesterIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;

  const from = Deno.env.get("EMAIL_FROM") ?? "SIGAP <otp@sigap.id>";
  const subject = Deno.env.get("EMAIL_SUBJECT") ?? "Kode OTP SIGAP Anda";
  const html = `<p>Kode OTP Anda adalah <strong>${code}</strong>.</p>
<p>Kode berlaku 10 menit. Jangan bagikan kepada siapa pun.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [email], subject, html }),
  });

  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_body" }, 400);
  }

  const rawEmail = body.email;
  if (!rawEmail || typeof rawEmail !== "string") {
    return jsonResponse({ ok: false, reason: "invalid_email" }, 400);
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, reason: "invalid_email" }, 400);
  }

  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();
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
    return jsonResponse(
      {
        ok: false,
        reason: limit?.reason === "too_many_for_email" ||
            limit?.reason === "too_many_for_ip"
          ? "too_many_attempts"
          : "rate_limited",
        retry_after_seconds: limit?.retry_after_seconds ?? 0,
      },
      429,
    );
  }

  const code = generateCode();
  const codeHash = await hashCode(code, pepper);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

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
    // Email failure cancels the code per PRD.
    await supabase.from("auth_otp_codes").delete().eq("id", insertData.id);
    return jsonResponse({ ok: false, reason: "email_failed" }, 502);
  }

  return jsonResponse({ ok: true });
});
