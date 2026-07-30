import { describe, it, expect } from "vitest";
import { buildTicketDocDefinition } from "./layout";

describe("buildTicketDocDefinition (issue #1913)", () => {
  const baseInput = {
    event: {
      title: "Campus Hackathon 2026",
      startDate: "2026-09-15T18:00:00Z",
      endDate: "2026-09-15T21:00:00Z",
      location: "Engineering Building, Room 204",
      clubName: "Web Dev Club",
      eventUrl: "https://campusconnect.example/events/abc",
    },
    attendee: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
    },
    ticketId: "AB12CD",
    qrCodeDataUrl: "data:image/png;base64,AAAA",
  };

  it("returns a valid pdfmake TDocumentDefinitions object", () => {
    const def = buildTicketDocDefinition(baseInput);
    expect(def).toBeDefined();
    expect(def.defaultStyle).toMatchObject({ font: "Helvetica" });
    expect(def.pageSize).toBe("LETTER");
  });

  it("emits content nodes for header, title, when/where, attendee, and footer", () => {
    const def = buildTicketDocDefinition(baseInput);
    const content = def.content as unknown[];
    // We don't introspect the full node tree (pdfmake types are loose),
    // but we can assert that content is a non-empty array.
    expect(Array.isArray(content)).toBe(true);
    expect((content as unknown[]).length).toBeGreaterThanOrEqual(5);
  });

  it("uses Helvetica family so we don't need a custom VFS", () => {
    const def = buildTicketDocDefinition(baseInput);
    expect(def.defaultStyle?.font).toBe("Helvetica");
  });

  it("includes the attendee full name when provided", () => {
    const def = buildTicketDocDefinition(baseInput);
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("Ada Lovelace");
  });

  it("falls back to the attendee email when fullName is missing", () => {
    const def = buildTicketDocDefinition({
      ...baseInput,
      attendee: { email: "ada@example.com" },
    });
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("ada@example.com");
  });

  it("falls back to 'Guest' when no attendee identity is provided", () => {
    const def = buildTicketDocDefinition({
      ...baseInput,
      attendee: {},
    });
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("Guest");
  });

  it("embeds the QR code data URL when provided", () => {
    const def = buildTicketDocDefinition(baseInput);
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("data:image/png;base64,AAAA");
  });

  it("omits the QR code block when qrCodeDataUrl is empty", () => {
    const def = buildTicketDocDefinition({ ...baseInput, qrCodeDataUrl: null });
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).not.toContain("data:image/png;base64");
  });

  it("includes the event URL in the footer when provided", () => {
    const def = buildTicketDocDefinition(baseInput);
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("https://campusconnect.example/events/abc");
  });

  it("omits the event URL footer line when eventUrl is empty", () => {
    const def = buildTicketDocDefinition({
      ...baseInput,
      event: { ...baseInput.event, eventUrl: null },
    });
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).not.toContain("https://campusconnect.example/events/abc");
  });

  it("includes the formatted event title", () => {
    const def = buildTicketDocDefinition(baseInput);
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("Campus Hackathon 2026");
  });

  it("falls back to 'TBA' for missing venue", () => {
    const def = buildTicketDocDefinition({
      ...baseInput,
      event: { ...baseInput.event, location: null },
    });
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("TBA");
  });

  it("uses the ticket id in the header band", () => {
    const def = buildTicketDocDefinition(baseInput);
    const contentStr = JSON.stringify(def.content);
    expect(contentStr).toContain("AB12CD");
  });
});
