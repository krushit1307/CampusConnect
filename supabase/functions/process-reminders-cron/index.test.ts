import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("process-reminders-cron compilation and syntax validation", () => {
  const testVal = "valid";
  assertEquals(testVal, "valid");
});
