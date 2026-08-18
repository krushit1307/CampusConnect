// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseUserAgent } from "./device-info.ts";

Deno.test("parseUserAgent - desktop Chrome on Windows", () => {
  const info = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  );
  assertEquals(info.browser, "Chrome");
  assertEquals(info.os, "Windows");
  assertEquals(info.device_info, "Windows • Chrome");
});

Deno.test("parseUserAgent - Safari on macOS", () => {
  const info = parseUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  );
  assertEquals(info.browser, "Safari");
  assertEquals(info.os, "macOS");
  assertEquals(info.device_info, "macOS • Safari");
});

Deno.test("parseUserAgent - mobile Safari on iPhone", () => {
  const info = parseUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  );
  assertEquals(info.browser, "Safari");
  assertEquals(info.os, "iOS");
});

Deno.test("parseUserAgent - Firefox on Android", () => {
  const info = parseUserAgent(
    "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0",
  );
  assertEquals(info.browser, "Firefox");
  assertEquals(info.os, "Android");
});

Deno.test("parseUserAgent - Edge on Windows", () => {
  const info = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  );
  assertEquals(info.browser, "Microsoft Edge");
  assertEquals(info.os, "Windows");
});

Deno.test("parseUserAgent - unknown / empty UA falls back safely", () => {
  const empty = parseUserAgent("");
  assertEquals(empty.browser, "Unknown");
  assertEquals(empty.os, "Unknown");
  assertEquals(parseUserAgent(null).browser, "Unknown");
});
