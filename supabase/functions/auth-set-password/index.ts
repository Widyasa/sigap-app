import { getServiceClient } from "../_shared/supabase.ts";
import { hashPassword } from "../_shared/password.ts";
import { verifyAccessToken } from "../_shared/jwt.ts";

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

function isStrongPassword(password: string): boolean {
  return password.length >= 8;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";
  let callerId: string;
  try {
    const payload = await verifyAccessToken(accessToken);
    callerId = payload.sub;
  } catch {
    return jsonResponse({ ok: false, reason: "unauthorized" }, 401);
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
  if (!isValidEmail(email) || !isStrongPassword(rawPassword)) {
    return jsonResponse({ ok: false, reason: "invalid_request" });
  }

  const pepper = Deno.env.get("PASSWORD_PEPPER") ?? Deno.env.get("OTP_PEPPER");
  if (!pepper) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const supabase = getServiceClient();

  // Verify caller is admin and target is a staff/admin user.
  const { data: callerRows, error: callerError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  if (callerError || callerRows?.role !== "admin") {
    return jsonResponse({ ok: false, reason: "forbidden" }, 403);
  }

  const { data: targetRows, error: targetError } = await supabase
    .from("users")
    .select("id, profiles(role)")
    .eq("email", email)
    .maybeSingle();

  if (targetError) {
    console.error("set-password target lookup error", targetError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  if (!targetRows) {
    return jsonResponse({ ok: false, reason: "user_not_found" });
  }

  const targetProfile = Array.isArray(targetRows.profiles)
    ? targetRows.profiles[0]
    : targetRows.profiles as { role: string } | null;

  if (targetProfile?.role === "citizen") {
    return jsonResponse({ ok: false, reason: "citizen_password_forbidden" });
  }

  const passwordHash = await hashPassword(rawPassword, pepper);

  const { error: updateError } = await supabase.rpc("set_user_password", {
    p_email: email,
    p_password_hash: passwordHash,
  });

  if (updateError) {
    console.error("set_user_password rpc error", updateError);
    return jsonResponse({ ok: false, reason: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
