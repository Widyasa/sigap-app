import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import type { Page } from '@playwright/test';

// Load .env.smoke from repo root (cwd-based so it works regardless of invocation path).
dotenvConfig({ path: resolve(process.cwd(), '.env.smoke') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const PUBLISHABLE_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const SIGAP_JWT_SECRET = requireEnv('SIGAP_JWT_SECRET');

function base64UrlEncode(input: Buffer | Uint8Array): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function runEmail(): string {
  return `playwright-${Date.now()}-${randomUUID().slice(0, 8)}@sigap.local`;
}

export async function cleanupTestUser(email: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from('auth_otp_codes').delete().ilike('email', email);
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (user) {
    await supabase.from('auth_sessions').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
  }
}

export async function cleanupUserData(email: string): Promise<void> {
  const supabase = serviceClient();
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (!user) return;
  const uid = user.id;

  const { data: complaints } = await supabase.from('complaints').select('id').eq('user_id', uid);
  const complaintIds = complaints?.map((c) => c.id) ?? [];

  if (complaintIds.length > 0) {
    await supabase.from('complaint_upvotes').delete().in('complaint_id', complaintIds);
    await supabase.from('complaint_timeline').delete().in('complaint_id', complaintIds);
  }
  await supabase.from('complaints').delete().eq('user_id', uid);

  await supabase.from('aspiration_votes').delete().eq('user_id', uid);
  await supabase.from('aspirations').delete().eq('user_id', uid);
  await supabase.from('service_requests').delete().eq('user_id', uid);
  await supabase.from('emergency_alerts').delete().eq('user_id', uid);
}

/**
 * Sign a SIGAP access token (HS256) that PostgREST/Realtime will accept.
 * Payload follows PRD S12: role and aud are 'authenticated'.
 */
export function signAccessToken(userId: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    // PostgREST menolak token dengan iat di masa depan. Untuk menghindari
    // perbedaan waktu mesin lokal/server, gunakan iat = 1 (epoch awal).
    iat: 1,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(payload)),
  )}`;
  const signature = createHmac('sha256', SIGAP_JWT_SECRET).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Log in a seeded staff user by injecting a signed access token into localStorage
 * and reloading the login page so AuthProvider picks it up and redirects.
 */
export async function seededLogin(
  page: Page,
  email: string,
): Promise<{ id: string; role: string; dinasId: string | null; kelurahan: string | null; kecamatan: string | null }> {
  const supabase = serviceClient();
  const { data: user, error } = await supabase.from('users').select('id').ilike('email', email).single();
  if (error || !user) throw new Error(`User not found for ${email}: ${error?.message}`);

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, dinas_id, kelurahan, kecamatan')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) throw new Error(`Profile not found for ${email}: ${pErr?.message}`);

  const token = signAccessToken(user.id);
  const expMs = Date.now() + 24 * 3600 * 1000;

  await page.goto('/login');
  await page.evaluate(
    ({ tk, rf, ex }: { tk: string; rf: string; ex: number }) => {
      localStorage.setItem('sigap_staff_access_token', tk);
      localStorage.setItem('sigap_staff_refresh_token', rf);
      localStorage.setItem('sigap_staff_access_token_exp', String(ex));
    },
    { tk: token, rf: 'dummy-refresh-token', ex: expMs },
  );
  await page.reload();

  // Wait until AuthProvider has loaded the profile and rendered the dashboard shell.
  await page.waitForSelector('nav[aria-label="Navigasi utama"]', { state: 'visible', timeout: 15000 });

  return {
    id: user.id,
    role: profile.role,
    dinasId: profile.dinas_id ?? null,
    kelurahan: profile.kelurahan ?? null,
    kecamatan: profile.kecamatan ?? null,
  };
}

/**
 * Full UI login flow using OTP_DEV_MODE=true.
 * The Edge Function returns devCode in the response body; we capture it,
 * fill the OTP input, and submit.
 */
export async function loginWithOtp(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email petugas').fill(email);

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/functions/v1/auth-request-otp') && resp.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Kirim Kode OTP' }).click();

  const response = await responsePromise;
  const body = (await response.json()) as { ok?: boolean; devCode?: string; reason?: string };
  if (!body.ok || !body.devCode) {
    throw new Error(`auth-request-otp failed: ${JSON.stringify(body)}`);
  }

  await page.locator('#login-otp').fill(body.devCode);
  await page.getByRole('button', { name: 'Verifikasi' }).click();

  // Operator is redirected to /darurat; everyone else to /.
  await page.waitForURL(/\/(darurat)?$/, { timeout: 15000 });
}

export async function clearWebSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('sigap_staff_access_token');
    localStorage.removeItem('sigap_staff_refresh_token');
    localStorage.removeItem('sigap_staff_access_token_exp');
  });
}
