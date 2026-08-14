import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

function getCookieHeader(token: string, isProduction: boolean) {
  return [
    `sb-access-token=${token}; Path=/`,
    "HttpOnly",
    "SameSite=Strict",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

Deno.test("Auth cookie header includes HttpOnly and SameSite=Strict", () => {
  const header = getCookieHeader("mock-jwt-token", false);
  assertStringIncludes(header, "HttpOnly");
  assertStringIncludes(header, "SameSite=Strict");
  assertEquals(header.includes("Secure"), false);
});

Deno.test("Auth cookie header includes Secure flag in production", () => {
  const header = getCookieHeader("mock-jwt-token", true);
  assertStringIncludes(header, "HttpOnly");
  assertStringIncludes(header, "SameSite=Strict");
  assertStringIncludes(header, "Secure");
});
