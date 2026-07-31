import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { isValidWebhookUrl } from "../supabase/functions/publish-webhooks/validator.ts";

Deno.test("isValidWebhookUrl prevents SSRF and accepts valid URLs", () => {
  // Valid
  assertEquals(isValidWebhookUrl("https://example.com/webhook"), true);
  assertEquals(isValidWebhookUrl("https://my-api.dev/events"), true);

  // Invalid - HTTP
  assertEquals(isValidWebhookUrl("http://example.com/webhook"), false);

  // Invalid - Localhost / Loopback
  assertEquals(isValidWebhookUrl("https://localhost/webhook"), false);
  assertEquals(isValidWebhookUrl("https://127.0.0.1/webhook"), false);
  assertEquals(isValidWebhookUrl("https://[::1]/webhook"), false);
  assertEquals(isValidWebhookUrl("https://0.0.0.0/webhook"), false);

  // Invalid - AWS Metadata
  assertEquals(isValidWebhookUrl("https://169.254.169.254/latest/meta-data/"), false);

  // Invalid - Private IP ranges
  assertEquals(isValidWebhookUrl("https://10.0.0.1/webhook"), false);
  assertEquals(isValidWebhookUrl("https://192.168.1.1/webhook"), false);
  assertEquals(isValidWebhookUrl("https://172.16.0.1/webhook"), false);
});
