import { describe, it, expect } from "vitest";
import { parseUtcToLocal, formatEventInTimeZone } from "@/lib/timezone";

describe("Timezone Handling across 3 distinct timezones", () => {
  const utcDateString = "2026-08-15T12:00:00.000Z";

  it("correctly parses UTC timestamps in UTC timezone", () => {
    const parsed = parseUtcToLocal(utcDateString, "UTC");
    expect(parsed).not.toBeNull();
    const formatted = formatEventInTimeZone(utcDateString, "yyyy-MM-dd HH:mm zzz", "UTC");
    expect(formatted).toContain("12:00");
    expect(formatted).toContain("UTC");
  });

  it("correctly parses UTC timestamps in America/New_York timezone", () => {
    const parsed = parseUtcToLocal(utcDateString, "America/New_York");
    expect(parsed).not.toBeNull();
    const formatted = formatEventInTimeZone(
      utcDateString,
      "yyyy-MM-dd HH:mm zzz",
      "America/New_York",
    );
    // 12:00 UTC is 08:00 EDT (UTC-4)
    expect(formatted).toContain("08:00");
  });

  it("correctly parses UTC timestamps in Asia/Tokyo timezone", () => {
    const parsed = parseUtcToLocal(utcDateString, "Asia/Tokyo");
    expect(parsed).not.toBeNull();
    const formatted = formatEventInTimeZone(utcDateString, "yyyy-MM-dd HH:mm zzz", "Asia/Tokyo");
    // 12:00 UTC is 21:00 JST (UTC+9)
    expect(formatted).toContain("21:00");
  });
});
