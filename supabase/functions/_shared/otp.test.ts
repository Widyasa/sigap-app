import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { generateCode, hashCode, verifyCode } from "./otp.ts";

const PEPPER = "test-pepper-do-not-reuse";

Deno.test("generateCode returns 6 digit string", () => {
  const code = generateCode();
  assertEquals(code.length, 6);
  assertEquals(/^\d{6}$/.test(code), true);
});

Deno.test("generateCode is different on repeated calls", () => {
  const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
  // Randomness makes collisions astronomically unlikely; 20 unique codes is a safe smoke test.
  assertEquals(codes.size, 20);
});

Deno.test("hashCode is deterministic and depends on pepper", async () => {
  const h1 = await hashCode("123456", PEPPER);
  const h2 = await hashCode("123456", PEPPER);
  const h3 = await hashCode("123456", "different-pepper");
  assertEquals(h1, h2);
  assertNotEquals(h1, h3);
});

Deno.test("verifyCode accepts matching code", async () => {
  const code = generateCode();
  const hash = await hashCode(code, PEPPER);
  assertEquals(await verifyCode(code, hash, PEPPER), true);
});

Deno.test("verifyCode rejects wrong code or wrong pepper", async () => {
  const code = generateCode();
  const hash = await hashCode(code, PEPPER);
  assertEquals(await verifyCode("000000", hash, PEPPER), false);
  assertEquals(await verifyCode(code, hash, "wrong-pepper"), false);
});

Deno.test("verifyCode rejects empty inputs", async () => {
  assertEquals(await verifyCode("", "abc", PEPPER), false);
  assertEquals(await verifyCode("123456", "", PEPPER), false);
  assertEquals(await verifyCode("123456", "abc", ""), false);
});
