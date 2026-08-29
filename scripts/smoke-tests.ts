#!/usr/bin/env node
/**
 * SIGAP end-to-end audit smoke tests.
 *
 * Run with a `.env.smoke` file in the repo root containing:
 *   SIGAP_JWT_SECRET=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
 *
 *   npx tsx scripts/smoke-tests.ts
 *
 * The script also accepts an alternate path via SMOKE_ENV_FILE.
 * Do NOT commit the env file.
 */

import * as crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/supabase';
import {
  createComplaint,
  uploadComplaintPhoto,
  createServiceRequest,
  uploadServiceDocument,
  listMyServiceRequests,
  listServiceRequestsForReview,
  updateServiceRequestStatus,
  generateServicePdf,
  createEmergencyAlert,
  importBudgetItems,
  listBudgetSummaryByDinas,
} from '@repo/supabase';
import { SERVICE_CATALOG, EMERGENCY_TYPES } from '@repo/shared';
import { exec } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const PROJECT_REF = 'kfbbaeuzvfzcbwjlopne';
const OTP_TEST_EMAIL = 'smoke-otp-probe@sigap.local';

const TEST_EMAILS = [
  'admin@sigap.local',
  'verifier@sigap.local',
  'dinas-staff@sigap.local',
  'dinas-head@sigap.local',
  'citizen@sigap.local',
  'citizen2@sigap.local',
] as const;

const EXPECTED_ROLES: Record<string, string> = {
  'admin@sigap.local': 'admin',
  'verifier@sigap.local': 'verifier',
  'dinas-staff@sigap.local': 'dinas_staff',
  'dinas-head@sigap.local': 'dinas_head',
  'citizen@sigap.local': 'citizen',
  'citizen2@sigap.local': 'citizen',
};

interface TestUser {
  email: string;
  id: string;
  role: string;
  dinasId: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  fullName: string;
  otpToken?: string;
}

interface CreatedIds {
  complaints: string[];
  complaintPhotoPaths: string[];
  emergencyAlerts: string[];
  serviceRequests: string[];
  serviceDocPaths: string[];
  generatedPdfPaths: string[];
  budgetItemIds: string[];
}

interface TestResult {
  name: string;
  ok: boolean;
  detail: string;
}

class SmokeTestError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message);
    this.name = 'SmokeTestError';
  }
}

// ---------------------------------------------------------------------------
// Environment + clients
// ---------------------------------------------------------------------------

interface SmokeConfig {
  supabaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SmokeTestError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadConfig(): SmokeConfig {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    jwtSecret: requireEnv('SIGAP_JWT_SECRET'),
  };
}

function createServiceClient(config: SmokeConfig): SupabaseClient<Database> {
  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createRoleClient(
  config: SmokeConfig,
  accessToken: string,
): SupabaseClient<Database> {
  return createClient<Database>(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

// ---------------------------------------------------------------------------
// JWT signing (matches Edge Function format)
// ---------------------------------------------------------------------------

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64url');
}

function signAccessToken(
  config: SmokeConfig,
  user: TestUser,
  email?: string,
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    jti: crypto.randomUUID(),
    role: 'authenticated',
    app_role: user.role,
    email: email ?? null,
    dinas_id: user.dinasId,
    kelurahan: user.kelurahan,
    kecamatan: user.kecamatan,
    type: 'access',
    iss: 'sigap',
    aud: 'sigap',
    iat: nowSeconds - 24 * 60 * 60,
    exp: nowSeconds + 24 * 60 * 60,
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// ---------------------------------------------------------------------------
// OTP helpers
// ---------------------------------------------------------------------------

async function runSupabaseCli(args: string, timeoutMs = 120000): Promise<string> {
  const cmd = `npx supabase ${args} --project-ref ${PROJECT_REF}`;
  const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
  return stdout || stderr || '';
}

async function checkOtpFunctionHealth(serviceClient: SupabaseClient<Database>): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await serviceClient
      .from('auth_otp_codes')
      .select('id')
      .limit(1);
    if (error) {
      return { ok: false, reason: `auth_otp_codes lookup failed: ${error.message}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: formatError(err) };
  }
}

async function isOtpDevModeActive(config: SmokeConfig): Promise<boolean> {
  try {
    const probeEmail = `probe-${Date.now()}@sigap.local`;
    const res = await fetch(`${config.supabaseUrl}/functions/v1/auth-request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: probeEmail }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    return 'devCode' in body && typeof body.devCode === 'string';
  } catch {
    return false;
  }
}

async function enableOtpDevMode(): Promise<void> {
  console.log('[OTP] Enabling OTP_DEV_MODE=true and redeploying OTP functions...');
  await runSupabaseCli('secrets set OTP_DEV_MODE=true');
  await runSupabaseCli('functions deploy auth-request-otp auth-verify-otp');
}

async function disableOtpDevMode(): Promise<void> {
  console.log('[OTP] Restoring OTP_DEV_MODE=false and redeploying OTP functions...');
  try {
    await runSupabaseCli('secrets set OTP_DEV_MODE=false');
    await runSupabaseCli('functions deploy auth-request-otp auth-verify-otp');
  } catch (err) {
    console.error('[OTP] Failed to restore OTP_DEV_MODE=false:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function requestOtp(config: SmokeConfig, email: string): Promise<string> {
  const res = await fetch(`${config.supabaseUrl}/functions/v1/auth-request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof body.devCode !== 'string') {
    throw new SmokeTestError(
      `auth-request-otp failed for ${email}: HTTP ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body.devCode;
}

async function verifyOtp(
  config: SmokeConfig,
  email: string,
  code: string,
): Promise<string> {
  const res = await fetch(`${config.supabaseUrl}/functions/v1/auth-verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof body.accessToken !== 'string') {
    throw new SmokeTestError(
      `auth-verify-otp failed for ${email}: HTTP ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body.accessToken as string;
}

async function fetchCurrentRole(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await client.rpc('current_role_name');
  if (error) {
    throw new SmokeTestError(`current_role_name RPC error: ${error.message}`, error);
  }
  return data as string;
}

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

async function loadTestUsers(serviceClient: SupabaseClient<Database>): Promise<Map<string, TestUser>> {
  const { data: users, error: usersError } = await serviceClient
    .from('users')
    .select('id, email')
    .in('email', TEST_EMAILS);
  if (usersError) {
    throw new SmokeTestError(`Failed to load users: ${usersError.message}`, usersError);
  }
  if (!users || users.length !== TEST_EMAILS.length) {
    throw new SmokeTestError(
      `Expected ${TEST_EMAILS.length} test users, found ${users?.length ?? 0}`,
    );
  }

  const userIds = users.map((u) => u.id);
  const { data: profiles, error: profilesError } = await serviceClient
    .from('profiles')
    .select('*')
    .in('id', userIds);
  if (profilesError) {
    throw new SmokeTestError(`Failed to load profiles: ${profilesError.message}`, profilesError);
  }

  const map = new Map<string, TestUser>();
  for (const user of users) {
    const profile = profiles?.find((p) => p.id === user.id);
    if (!profile) {
      throw new SmokeTestError(`Missing profile for ${user.email} (${user.id})`);
    }
    map.set(user.email, {
      email: user.email,
      id: user.id,
      role: profile.role,
      dinasId: profile.dinas_id,
      kelurahan: profile.kelurahan,
      kecamatan: profile.kecamatan,
      fullName: profile.full_name,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

function minimalPng(): ArrayBuffer {
  // 1x1 transparent PNG, valid and tiny.
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1YAAAAASUVORK5CYII=',
    'base64',
  );
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function parseStoragePath(publicUrl: string, bucket: string): string {
  const url = new URL(publicUrl);
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!url.pathname.startsWith(prefix)) {
    throw new SmokeTestError(`Unexpected public URL path: ${url.pathname}`);
  }
  return decodeURIComponent(url.pathname.slice(prefix.length));
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const results: TestResult[] = [];

function formatError(err: unknown): string {
  if (err instanceof Error) {
    let msg = `${err.name}: ${err.message}`;
    if ('code' in err && err.code) msg += ` (code: ${String(err.code)})`;
    if ('details' in err && err.details) msg += ` (details: ${String(err.details)})`;
    if ('hint' in err && err.hint) msg += ` (hint: ${String(err.hint)})`;
    return msg;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function runTest<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const value = await fn();
    results.push({ name, ok: true, detail: 'PASS' });
    console.log(`[PASS] ${name}`);
    return value;
  } catch (err) {
    const detail = formatError(err);
    results.push({ name, ok: false, detail });
    console.error(`[FAIL] ${name}: ${detail}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== SIGAP Audit Smoke Tests ===');
  const envFile = process.env.SMOKE_ENV_FILE ?? '.env.smoke';
  loadEnvFile(envFile);
  const config = loadConfig();
  const serviceClient = createServiceClient(config);

  const users = await loadTestUsers(serviceClient);
  const citizen = users.get('citizen@sigap.local')!;
  const verifier = users.get('verifier@sigap.local')!;
  const dinasStaff = users.get('dinas-staff@sigap.local')!;
  const dinasHead = users.get('dinas-head@sigap.local')!;
  const admin = users.get('admin@sigap.local')!;

  const created: CreatedIds = {
    complaints: [],
    complaintPhotoPaths: [],
    emergencyAlerts: [],
    serviceRequests: [],
    serviceDocPaths: [],
    generatedPdfPaths: [],
    budgetItemIds: [],
  };

  let otpModeChanged = false;

  try {
    // A. OTP login flow for all 6 test users (best-effort; skipped if dev mode
    // or the deployed functions are not functional).
    let otpEnabled = false;
    await runTest('OTP: enable dev mode', async () => {
      const health = await checkOtpFunctionHealth(serviceClient);
      if (!health.ok) {
        throw new SmokeTestError(`OTP function unhealthy: ${health.reason}`);
      }
      const alreadyActive = await isOtpDevModeActive(config);
      if (!alreadyActive) {
        await enableOtpDevMode();
      }
      const confirmed = await isOtpDevModeActive(config);
      if (!confirmed) {
        throw new SmokeTestError('OTP dev mode did not activate after deploy');
      }
      otpEnabled = true;
      otpModeChanged = true;
    });

    if (otpEnabled) {
      for (const email of TEST_EMAILS) {
        await runTest(`OTP login: ${email}`, async () => {
          const code = await requestOtp(config, email);
          const token = await verifyOtp(config, email, code);
          const user = users.get(email)!;
          user.otpToken = token;

          const client = createRoleClient(config, token);
          const role = await fetchCurrentRole(client);
          const expected = EXPECTED_ROLES[email];
          if (role !== expected) {
            throw new SmokeTestError(`Expected role ${expected}, got ${role}`);
          }
          return { role };
        });
      }
    }

    // Pre-generate tokens for the role-specific flows (reusing OTP tokens or fresh).
    const citizenClient = createRoleClient(config, signAccessToken(config, citizen, citizen.email));
    const verifierClient = createRoleClient(config, signAccessToken(config, verifier, verifier.email));
    const dinasStaffClient = createRoleClient(
      config,
      signAccessToken(config, dinasStaff, dinasStaff.email),
    );
    const adminToken = signAccessToken(config, admin, admin.email);
    const adminClient = createRoleClient(config, adminToken);
    const dinasHeadClient = createRoleClient(
      config,
      signAccessToken(config, dinasHead, dinasHead.email),
    );

    // B. Citizen creates a complaint with a PNG upload.
    let complaintId: string | undefined;
    await runTest('Citizen: create complaint with photo', async () => {
      const photoPublicUrl = await uploadComplaintPhoto(
        citizenClient,
        citizen.id,
        minimalPng(),
        'image/png',
      );
      created.complaintPhotoPaths.push(parseStoragePath(photoPublicUrl, 'complaint-photos'));

      const result = await createComplaint(
        citizenClient,
        citizen.id,
        {
          description: 'Ini adalah aduan uji asap dari smoke test SIGAP. Jalan rusak parah.',
          locationLat: -6.9147,
          locationLng: 107.6098,
          locationAddress: 'Jl. Smoke Test No. 1, Bandung',
          imageUrls: [photoPublicUrl],
        },
        { kelurahan: citizen.kelurahan, kecamatan: citizen.kecamatan },
      );
      complaintId = result.id;
      created.complaints.push(result.id);
      return { complaintId: result.id };
    });

    // C. Citizen creates an emergency alert (SOS).
    await runTest('Citizen: create emergency alert (SOS)', async () => {
      const result = await createEmergencyAlert(citizenClient, citizen.id, {
        emergencyType: EMERGENCY_TYPES[0].id,
        locationLat: -6.9147,
        locationLng: 107.6098,
        locationAddress: 'Jl. Smoke Test No. 2, Bandung',
        note: 'Aduan darurat uji asap',
      });
      created.emergencyAlerts.push(result.id);
      return { emergencyAlertId: result.id };
    });

    // D. Citizen creates a service request (kelahiran) with a document upload.
    let serviceRequestId: string | undefined;
    await runTest('Citizen: create service request (kelahiran)', async () => {
      const docPath = await uploadServiceDocument(
        citizenClient,
        citizen.id,
        minimalPng(),
        'image/png',
      );
      created.serviceDocPaths.push(docPath);

      const result = await createServiceRequest(citizenClient, citizen.id, {
        serviceType: 'kelahiran',
        formData: {
          fullName: 'Orang Tua Uji',
          nik: '3201234567890123',
          address: 'Jl. Smoke Test No. 3, Bandung',
          childName: 'Bayi Uji',
          birthDate: '2026-08-01',
          birthPlace: 'Bandung',
          motherName: 'Ibu Uji',
          fatherName: 'Ayah Uji',
        },
        documentUrls: [docPath],
      });
      serviceRequestId = result.id;
      created.serviceRequests.push(result.id);
      return { serviceRequestId: result.id };
    });

    // E. Verifier lists service requests for review and updates to verifying.
    await runTest('Verifier: list and advance request to verifying', async () => {
      if (!serviceRequestId) throw new SmokeTestError('No service request from step D');
      const reviewList = await listServiceRequestsForReview(verifierClient);
      const found = reviewList.find((r) => r.id === serviceRequestId);
      if (!found) throw new SmokeTestError('Service request not found in verifier review list');
      if (found.status !== 'submitted') {
        throw new SmokeTestError(`Expected status submitted, got ${found.status}`);
      }
      await updateServiceRequestStatus(verifierClient, serviceRequestId, {
        currentStatus: 'submitted',
        status: 'verifying',
        handledBy: verifier.id,
      });
      return { advancedTo: 'verifying' };
    });

    // F. Dinas-staff updates the same request to signing.
    await runTest('Dinas-staff: advance request to signing', async () => {
      if (!serviceRequestId) throw new SmokeTestError('No service request from step D');
      await updateServiceRequestStatus(dinasStaffClient, serviceRequestId, {
        currentStatus: 'verifying',
        status: 'signing',
        handledBy: dinasStaff.id,
      });
      return { advancedTo: 'signing' };
    });

    // G. Staff/admin calls generate-service-pdf Edge Function.
    let pdfResult: { verificationCode?: string; pdfPath?: string } | undefined;
    await runTest('Admin: generate service PDF', async () => {
      if (!serviceRequestId) throw new SmokeTestError('No service request from step D');
      const freshAdminToken = signAccessToken(config, admin, admin.email);
      const res = await generateServicePdf(config.supabaseUrl, freshAdminToken, serviceRequestId);
      if (!res.ok || !res.verificationCode || !res.pdfPath) {
        throw new SmokeTestError(
          `generate-service-pdf failed: ${res.reason ?? JSON.stringify(res)}`,
        );
      }
      pdfResult = res;
      if (res.pdfPath) created.generatedPdfPaths.push(res.pdfPath);
      return res;
    });

    // H. Citizen lists service requests and confirms PDF URL present.
    await runTest('Citizen: list my service requests and confirm PDF', async () => {
      const list = await listMyServiceRequests(citizenClient, citizen.id);
      const found = list.find((r) => r.id === serviceRequestId);
      if (!found) throw new SmokeTestError('Service request not in citizen list');
      if (found.status !== 'ready') {
        throw new SmokeTestError(`Expected status ready, got ${found.status}`);
      }
      if (!found.outputPdfUrl) {
        throw new SmokeTestError('output_pdf_url is missing on generated request');
      }
      if (pdfResult?.pdfPath && found.outputPdfUrl !== pdfResult.pdfPath) {
        throw new SmokeTestError(
          `PDF path mismatch: expected ${pdfResult.pdfPath}, got ${found.outputPdfUrl}`,
        );
      }
      return { outputPdfUrl: found.outputPdfUrl };
    });

    // I. Admin imports a small budget CSV.
    await runTest('Admin: import budget items', async () => {
      const fiscalYear = new Date().getFullYear();

      // Clean up stale rows from earlier failed runs before asserting.
      const { data: staleRows, error: staleErr } = await serviceClient
        .from('budget_items')
        .select('id')
        .eq('fiscal_year', fiscalYear)
        .ilike('program_name', '%Uji Asap%');
      if (staleErr) throw new SmokeTestError(`Budget cleanup lookup failed: ${staleErr.message}`, staleErr);
      const staleIds = (staleRows ?? []).map((r) => r.id);
      if (staleIds.length) {
        const { error: delErr } = await serviceClient.from('budget_items').delete().in('id', staleIds);
        if (delErr) throw new SmokeTestError(`Budget cleanup delete failed: ${delErr.message}`, delErr);
      }

      const runId = Date.now().toString(36);
      const programName = `Program Uji Asap ${runId}`;
      const payload = [
        {
          fiscalYear,
          dinasId: 'pupr',
          programName,
          activityName: 'Kegiatan Uji Asap A',
          budgetAllocated: 100_000_000,
          budgetRealized: 25_000_000,
          locationAddress: 'Jl. Anggaran Uji No. 1',
          kelurahan: 'Cidadap',
          kecamatan: 'Cidadap',
          progressPercent: 25,
          contractor: 'PT Uji Asap',
        },
        {
          fiscalYear,
          dinasId: 'pupr',
          programName,
          activityName: 'Kegiatan Uji Asap B',
          budgetAllocated: 50_000_000,
          budgetRealized: 0,
          locationAddress: 'Jl. Anggaran Uji No. 2',
          kelurahan: 'Cidadap',
          kecamatan: 'Cidadap',
          progressPercent: 0,
          contractor: 'PT Uji Asap',
        },
      ];
      const { inserted } = await importBudgetItems(adminClient, payload);
      if (inserted !== payload.length) {
        throw new SmokeTestError(`Expected ${payload.length} inserts, got ${inserted}`);
      }

      // Verify only the rows created in this run exist.
      const { data: rows, error } = await serviceClient
        .from('budget_items')
        .select('id, fiscal_year, dinas_id, program_name, activity_name, budget_allocated, budget_realized')
        .eq('fiscal_year', fiscalYear)
        .eq('dinas_id', 'pupr')
        .ilike('program_name', `%Uji Asap ${runId}%`)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw new SmokeTestError(`Budget ID lookup failed: ${error.message}`, error);
      if ((rows ?? []).length !== payload.length) {
        throw new SmokeTestError(`Expected ${payload.length} budget rows, found ${(rows ?? []).length}`);
      }
      for (const row of rows ?? []) created.budgetItemIds.push(row.id);

      return { inserted, rowCount: rows?.length };
    });

    // J. Dinas-head lists budget summary for current fiscal year.
    await runTest('Dinas-head: listBudgetSummaryByDinas', async () => {
      const fiscalYear = new Date().getFullYear();
      const summary = await listBudgetSummaryByDinas(dinasHeadClient, fiscalYear);
      const pupr = summary.find((s) => s.dinasId === 'pupr');
      if (!pupr) throw new SmokeTestError('pupr not present in budget summary');
      return { dinasCount: summary.length, puprTotalAllocated: pupr.totalAllocated };
    });
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup test data
    // -------------------------------------------------------------------------
    console.log('\n=== Cleanup ===');
    const cleanupErrors: string[] = [];

    const tryDelete = async (label: string, operation: PromiseLike<unknown>) => {
      try {
        await operation;
        console.log(`[CLEANUP] ${label}: OK`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        cleanupErrors.push(`${label}: ${msg}`);
        console.error(`[CLEANUP] ${label}: FAILED - ${msg}`);
      }
    };

    if (created.complaints.length) {
      await tryDelete('complaints', serviceClient.from('complaints').delete().in('id', created.complaints));
    }
    if (created.emergencyAlerts.length) {
      await tryDelete('emergency alerts', serviceClient.from('emergency_alerts').delete().in('id', created.emergencyAlerts));
    }
    if (created.serviceRequests.length) {
      await tryDelete('service requests', serviceClient.from('service_requests').delete().in('id', created.serviceRequests));
    }
    if (created.budgetItemIds.length) {
      await tryDelete('budget items', serviceClient.from('budget_items').delete().in('id', created.budgetItemIds));
    }
    if (created.complaintPhotoPaths.length) {
      await tryDelete('complaint photos', serviceClient.storage.from('complaint-photos').remove(created.complaintPhotoPaths));
    }
    const allServiceDocPaths = [...created.serviceDocPaths, ...created.generatedPdfPaths];
    if (allServiceDocPaths.length) {
      await tryDelete('service docs', serviceClient.storage.from('service-docs').remove(allServiceDocPaths));
    }

    // Always reset OTP_DEV_MODE=false, even if tests fail.
    try {
      await disableOtpDevMode();
      console.log('[OTP] Restored OTP_DEV_MODE=false');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      cleanupErrors.push(`OTP reset: ${msg}`);
      console.error(`[OTP] Cleanup failed: ${msg}`);
    }

    if (cleanupErrors.length) {
      console.error('\nCleanup errors:', cleanupErrors);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== Results ===');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${r.name}: ${r.detail}`);
  }
  console.log(`\nTotal: ${passed} passed, ${failed} failed out of ${results.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
