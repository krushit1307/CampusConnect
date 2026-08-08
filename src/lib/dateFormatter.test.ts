import { describe, expect, it } from "vitest";

import { formatDateLong, formatDateShort, formatTime, formatWeekdayTime } from "./dateFormatter";

describe("dateFormatter", () => {
  it("formats ISO dates using the cached long-date formatter", () => {
    expect(formatDateLong("2024-10-15T12:00:00")).toBe("October 15, 2024");
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatDateLong("not-a-date")).toBe("");
  });

  it("formats compact dates and times", () => {
    const date = new Date(2024, 9, 15, 14, 30);
    expect(formatDateShort(date)).toBe("Oct 15, 2024");
    expect(formatTime(date)).toBe("2:30 PM");
    expect(formatWeekdayTime(date)).toBe("Tue 2:30 PM");
  });
});
