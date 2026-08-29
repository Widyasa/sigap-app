import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert";
import {
  createAccessToken,
  createRefreshToken,
  getTokenExpirySeconds,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt.ts";

const TEST_SECRET = "test-secret-must-be-at-least-32-bytes-long-ok";

Deno.test("create/verify access token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("11111111-1111-1111-1111-111111111111", {
    role: "citizen",
    dinas_id: null,
    kelurahan: "Sukamaju",
    kecamatan: "Cibeunying",
  });
  const payload = await verifyAccessToken(token);
  assertEquals(payload.sub, "11111111-1111-1111-1111-111111111111");
  assertEquals(payload.role, "authenticated");
  assertEquals(payload.app_role, "citizen");
  assertEquals(payload.type, "access");
  assertEquals(payload.iss, "sigap");
  assertEquals(payload.aud, "sigap");
  assertEquals(payload.kelurahan, "Sukamaju");
  assertEquals(payload.dinas_id, null);
});

Deno.test("create/verify refresh token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createRefreshToken("22222222-2222-2222-2222-222222222222");
  const payload = await verifyRefreshToken(token);
  assertEquals(payload.sub, "22222222-2222-2222-2222-222222222222");
  assertEquals(payload.type, "refresh");
});

Deno.test("access token rejects refresh token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const refresh = await createRefreshToken("33333333-3333-3333-3333-333333333333");
  await assertRejects(() => verifyAccessToken(refresh));
});

Deno.test("verify rejects tampered token", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("44444444-4444-4444-4444-444444444444", {
    role: "admin",
  });
  const tampered = token.slice(0, -5) + "XXXXX";
  await assertRejects(() => verifyAccessToken(tampered));
});

Deno.test("verify rejects token signed with different secret", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", "secret-one-is-long-enough-for-tests");
  const token = await createAccessToken("55555555-5555-5555-5555-555555555555", {
    role: "verifier",
  });
  Deno.env.set("SUPABASE_JWT_SECRET", "secret-two-is-long-enough-for-tests");
  await assertRejects(() => verifyAccessToken(token));
});

Deno.test("getTokenExpirySeconds returns future timestamp", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const token = await createAccessToken("66666666-6666-6666-6666-666666666666", {
    role: "citizen",
  });
  const now = Math.floor(Date.now() / 1000);
  const exp = getTokenExpirySeconds(token);
  assertEquals(exp > now, true);
  assertEquals(exp <= now + 3600 + 1, true);
});

Deno.test("each token is unique", async () => {
  Deno.env.set("SUPABASE_JWT_SECRET", TEST_SECRET);
  const a = await createAccessToken("77777777-7777-7777-7777-777777777777", { role: "citizen" });
  const b = await createAccessToken("77777777-7777-7777-7777-777777777777", { role: "citizen" });
  assertNotEquals(a, b);
});
