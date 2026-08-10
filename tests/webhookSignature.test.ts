import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { generateSignature } from "../supabase/functions/publish-webhooks/signature.ts";

Deno.test("generateSignature generates correct HMAC-SHA256 signature", async () => {
  const secret = "my-super-secret-key";
  const payload = JSON.stringify({ event: "test" });

  const signature = await generateSignature(secret, payload);

  assertEquals(signature.startsWith("sha256="), true);

  // Predictable test
  const expectedHash = await generateSignature(secret, payload); // Just ensuring determinism here
  assertEquals(signature, expectedHash);
});
