import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert";
import {
  createAccessToken,
  createRefreshToken,
  getTokenExpirySeconds,
  verifyAccessToken,
} from "./jwt.ts";

const TEST_SECRET = "test-secret-must-be-at-least-32-bytes-long-ok";

Deno.test("create/verify access token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("11111111-1111-1111-1111-111111111111");
  const payload = await verifyAccessToken(token);
  assertEquals(payload.sub, "11111111-1111-1111-1111-111111111111");
  assertEquals(payload.role, "authenticated");
  assertEquals(payload.type, "access");
  assertEquals(payload.iss, "sigap");
  assertEquals(payload.aud, "authenticated");
  assertEquals((payload as unknown as Record<string, unknown>).app_role, undefined);
  assertEquals((payload as unknown as Record<string, unknown>).email, undefined);
});

Deno.test("create refresh token returns 32-byte hex", async () => {
  const token = await createRefreshToken();
  assertEquals(typeof token, "string");
  assertEquals(token.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(token), true);
});

Deno.test("access token rejects refresh token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const refresh = await createRefreshToken();
  await assertRejects(() => verifyAccessToken(refresh));
});

Deno.test("verify rejects tampered token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("44444444-4444-4444-4444-444444444444");
  const tampered = token.slice(0, -5) + "XXXXX";
  await assertRejects(() => verifyAccessToken(tampered));
});

Deno.test("verify rejects token signed with different secret", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", "secret-one-is-long-enough-for-tests");
  const token = await createAccessToken("55555555-5555-5555-5555-555555555555");
  Deno.env.set("SUPABASE_JWT_SECRET", "secret-two-is-long-enough-for-tests");
  await assertRejects(() => verifyAccessToken(token));
});

Deno.test("getTokenExpirySeconds returns future timestamp", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("66666666-6666-6666-6666-666666666666");
  const now = Math.floor(Date.now() / 1000);
  const exp = getTokenExpirySeconds(token);
  assertEquals(exp > now, true);
  assertEquals(exp <= now + 3600 + 1, true);
});

Deno.test("each token is unique", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const a = await createAccessToken("77777777-7777-7777-7777-777777777777");
  const b = await createAccessToken("77777777-7777-7777-7777-777777777777");
  assertNotEquals(a, b);
});
