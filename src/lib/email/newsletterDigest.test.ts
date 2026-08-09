import { describe, it, expect } from "vitest";
import {
  compileNewsletterDigestHtml,
  compileNewsletterDigestText,
  escapeHtml,
  formatDigestDate,
  type DigestEventItem,
} from "./newsletterDigest";

describe("Newsletter Digest Utilities (#1559)", () => {
  const sampleEvents: DigestEventItem[] = [
    {
      id: "event-111-aaa",
      title: "AI & ML Hackathon <2026>",
      event_date: "2026-08-15T18:00:00.000Z",
      location: "Building B & Online",
      clubs: { name: "Robotics & Tech Club" },
    },
    {
      id: "event-222-bbb",
      title: "Campus Welcome BBQ & Music",
      event_date: "2026-08-18T12:00:00.000Z",
      location: "Main Quad Lawn",
      clubs: [{ name: "Student Life Committee" }],
    },
  ];

  describe("escapeHtml", () => {
    it("escapes HTML special characters to prevent XSS", () => {
      expect(escapeHtml("Robotics & Tech <Club> '26")).toBe(
        "Robotics &amp; Tech &lt;Club&gt; &#039;26",
      );
    });

    it("handles empty or null values gracefully", () => {
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("formatDigestDate", () => {
    it("formats ISO date string into readable text", () => {
      const formatted = formatDigestDate("2026-08-15T18:00:00.000Z");
      expect(formatted).toContain("Aug");
      expect(formatted).toContain("15");
    });
  });

  describe("compileNewsletterDigestHtml", () => {
    it("generates HTML containing upcoming event details and branding", () => {
      const html = compileNewsletterDigestHtml({
        events: sampleEvents,
        appUrl: "https://campusconnect.app",
      });

      expect(html).toContain("CAMPUS");
      expect(html).toContain("CONNECT");
      expect(html).toContain("Upcoming Events Digest (Next 7 Days)");
      expect(html).toContain("AI &amp; ML Hackathon &lt;2026&gt;");
      expect(html).toContain("Robotics &amp; Tech Club");
      expect(html).toContain("Building B &amp; Online");
      expect(html).toContain("Campus Welcome BBQ &amp; Music");
      expect(html).toContain("https://campusconnect.app/events/event-111-aaa");
      expect(html).toContain("https://campusconnect.app/settings");
    });

    it("handles events with missing location or club", () => {
      const minimalEvents: DigestEventItem[] = [
        {
          id: "event-333",
          title: "General Body Meeting",
          event_date: "2026-08-20T17:00:00.000Z",
        },
      ];

      const html = compileNewsletterDigestHtml({ events: minimalEvents });
      expect(html).toContain("General Body Meeting");
      expect(html).toContain("📍 Location: TBA");
      expect(html).toContain("Campus Club");
    });
  });

  describe("compileNewsletterDigestText", () => {
    it("generates plain text containing upcoming event details", () => {
      const text = compileNewsletterDigestText({
        events: sampleEvents,
        appUrl: "https://campusconnect.app",
      });

      expect(text).toContain("CAMPUSCONNECT - Upcoming Events Digest (Next 7 Days)");
      expect(text).toContain("1. AI & ML Hackathon <2026>");
      expect(text).toContain("Club: Robotics & Tech Club");
      expect(text).toContain("Link: https://campusconnect.app/events/event-111-aaa");
      expect(text).toContain("Update preferences at https://campusconnect.app/settings");
    });
  });
});
