import { describe, it, expect } from "vitest";
import { parseFlyerText } from "./flyerOcrParser";

describe("Client-side Flyer OCR Parser (#2653)", () => {
  it("parses title, date, time, and location from raw flyer text", () => {
    const rawFlyerText = `
      ANNUAL TECH SYMPOSIUM 2026
      Join us for exciting keynotes and project showcases!
      Date: Oct 24th, 2026
      Time: 7:00 PM
      Location: Main Auditorium
    `;

    const data = parseFlyerText(rawFlyerText);

    expect(data.title).toBe("TECH SYMPOSIUM 2026");
    expect(data.dateStr).toBe("Oct 24th, 2026");
    expect(data.timeStr).toBe("7:00 PM");
    expect(data.location).toBe("Main Auditorium");
    expect(data.confidence).toBe(100);
  });

  it("handles alternative date and time formats (e.g. 10/24/2026 and 19:30)", () => {
    const rawFlyerText = `
      Hackathon Championship
      10/24/2026 at 19:30
      Student Union Hall B
    `;

    const data = parseFlyerText(rawFlyerText);

    expect(data.title).toBe("Hackathon Championship");
    expect(data.dateStr).toBe("10/24/2026");
    expect(data.timeStr).toBe("19:30");
    expect(data.location).toBe("Student Union Hall B");
  });

  it("returns zero confidence for empty or whitespace text", () => {
    const emptyData = parseFlyerText("");
    expect(emptyData.confidence).toBe(0);
    expect(emptyData.title).toBeUndefined();
  });
});
