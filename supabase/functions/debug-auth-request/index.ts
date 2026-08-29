import { getServiceClient } from "../_shared/supabase.ts";
import { generateCode, hashCode } from "../_shared/otp.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const steps: { step: string; ok: boolean; error?: string; data?: unknown }[] = [];
  const email = "admin@sigap.local";
  const nowIso = new Date().toISOString();

  try {
    const supabase = getServiceClient();
    steps.push({ step: "getServiceClient", ok: true });

    const { data: limitData, error: limitError } = await supabase.rpc(
      "check_otp_rate_limit",
      { p_email: email, p_ip: null },
    );
    steps.push({ step: "check_otp_rate_limit", ok: !limitError, error: limitError?.message, data: limitData });

    const pepper = Deno.env.get("OTP_PEPPER");
    steps.push({ step: "getEnv", ok: !!pepper, data: { pepperLength: pepper?.length } });

    const code = generateCode();
    const codeHash = await hashCode(code, pepper ?? "");
    steps.push({ step: "hashCode", ok: true, data: { codeLength: code.length, codeHashLength: codeHash.length } });

    const { error: invalidateError } = await supabase
      .from("auth_otp_codes")
      .update({ consumed_at: nowIso })
      .eq("email", email)
      .is("consumed_at", null);
    steps.push({ step: "invalidatePrevious", ok: !invalidateError, error: invalidateError?.message });

    const { data: insertData, error: insertError } = await supabase
      .from("auth_otp_codes")
      .insert({ email, code_hash: codeHash, requester_ip: null, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
      .select("id")
      .single();
    steps.push({ step: "insertCode", ok: !insertError, error: insertError?.message, data: insertData });

    return jsonResponse({ ok: true, steps, devCode: code });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err), steps }, 500);
  }
});
