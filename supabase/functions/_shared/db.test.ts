import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getPooledConnectionString } from "./db.ts";

Deno.test("getPooledConnectionString appends pgbouncer=true parameter", () => {
  const input = "postgres://user:pass@localhost:6543/postgres";
  const expected = "postgres://user:pass@localhost:6543/postgres?pgbouncer=true";
  assertEquals(getPooledConnectionString(input), expected);
});

Deno.test(
  "getPooledConnectionString preserves existing params when appending pgbouncer=true",
  () => {
    const input = "postgres://user:pass@localhost:6543/postgres?sslmode=disable";
    const expected = "postgres://user:pass@localhost:6543/postgres?sslmode=disable&pgbouncer=true";
    assertEquals(getPooledConnectionString(input), expected);
  },
);

Deno.test("getPooledConnectionString does not duplicate pgbouncer=true if present", () => {
  const input = "postgres://user:pass@localhost:6543/postgres?pgbouncer=true";
  assertEquals(getPooledConnectionString(input), input);
});
