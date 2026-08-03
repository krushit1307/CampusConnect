import { describe, it, expect } from "vitest";
import {
  buildOpenGraphTags,
  buildOgImageUrl,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  type EventMetaInput,
} from "./eventMeta";

const baseInput: EventMetaInput = {
  title: "Campus Hackathon 2026",
  description: "<p>Build something <strong>awesome</strong> in 48 hours.</p>",
  bannerUrl: "https://example.supabase.co/storage/v1/object/public/events/banner.png",
  eventDate: "2026-09-15T18:00:00Z",
  location: "Engineering Building, Room 204",
  url: "https://campusconnect.example/events/abc123",
};

describe("buildOgImageUrl (issue #1904)", () => {
  it("appends the 1200x630 Supabase transform when no query string exists", () => {
    expect(buildOgImageUrl("https://example.supabase.co/banner.png")).toBe(
      "https://example.supabase.co/banner.png?width=1200&height=630&resize=cover",
    );
  });

  it("uses & instead of ? when the URL already has a query string", () => {
    expect(buildOgImageUrl("https://example.supabase.co/banner.png?v=1")).toBe(
      "https://example.supabase.co/banner.png?v=1&width=1200&height=630&resize=cover",
    );
  });

  it("returns empty string when the input is empty so the caller can omit the meta tag", () => {
    expect(buildOgImageUrl("")).toBe("");
  });

  it("uses the documented 1200x630 dimensions (issue spec edge case)", () => {
    expect(OG_IMAGE_WIDTH).toBe(1200);
    expect(OG_IMAGE_HEIGHT).toBe(630);
  });
});

describe("buildOpenGraphTags (issue #1904)", () => {
  it("produces an ogTitle of '<title> | CampusConnect'", () => {
    expect(buildOpenGraphTags(baseInput).ogTitle).toBe("Campus Hackathon 2026 | CampusConnect");
  });

  it("strips HTML from the description", () => {
    const result = buildOpenGraphTags(baseInput);
    expect(result.ogDescription).not.toContain("<p>");
    expect(result.ogDescription).not.toContain("<strong>");
    expect(result.ogDescription).toContain("awesome");
  });

  it("clamps the description to 200 characters", () => {
    const longDesc = "a".repeat(500);
    const result = buildOpenGraphTags({ ...baseInput, description: longDesc });
    expect(result.ogDescription.length).toBeLessThanOrEqual(200);
  });

  it("falls back to a location-based description when description is missing", () => {
    const result = buildOpenGraphTags({ ...baseInput, description: null });
    expect(result.ogDescription).toBe("Join us at Engineering Building, Room 204.");
  });

  it("falls back to a generic line when neither description nor location is set", () => {
    const result = buildOpenGraphTags({
      ...baseInput,
      description: null,
      location: null,
    });
    expect(result.ogDescription).toBe("An event on CampusConnect.");
  });

  it("resizes the banner URL to 1200x630 via the Supabase render transform", () => {
    const result = buildOpenGraphTags(baseInput);
    expect(result.ogImage).toContain("width=1200");
    expect(result.ogImage).toContain("height=630");
    expect(result.ogImage).toContain("resize=cover");
  });

  it("returns empty ogImage when bannerUrl is missing", () => {
    const result = buildOpenGraphTags({ ...baseInput, bannerUrl: null });
    expect(result.ogImage).toBe("");
  });

  it("preserves the event start time as an ISO string for og:event:start_time", () => {
    const result = buildOpenGraphTags(baseInput);
    expect(result.eventStartTime).toBe("2026-09-15T18:00:00Z");
  });

  it("returns empty eventStartTime when eventDate is missing", () => {
    const result = buildOpenGraphTags({ ...baseInput, eventDate: null });
    expect(result.eventStartTime).toBe("");
  });

  it("uses the supplied absolute URL for og:url", () => {
    const result = buildOpenGraphTags(baseInput);
    expect(result.ogUrl).toBe("https://campusconnect.example/events/abc123");
  });

  it("returns empty ogUrl when not supplied", () => {
    const result = buildOpenGraphTags({ ...baseInput, url: null });
    expect(result.ogUrl).toBe("");
  });

  it("trims whitespace before applying the length cap to the description", () => {
    const result = buildOpenGraphTags({ ...baseInput, description: "   hello world   " });
    expect(result.ogDescription.startsWith(" ")).toBe(false);
    expect(result.ogDescription).toBe("hello world");
  });

  it("uses the raw banner URL when the URL has no query string so the transform is appended", () => {
    const result = buildOpenGraphTags({
      ...baseInput,
      bannerUrl: "https://cdn.example.com/banner.jpg",
    });
    expect(result.ogImage).toBe(
      "https://cdn.example.com/banner.jpg?width=1200&height=630&resize=cover",
    );
  });
});
