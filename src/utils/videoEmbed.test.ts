import { describe, expect, it } from "vitest";
import { getEmbedUrl, parseVideoUrl } from "./videoEmbed";

describe("videoEmbed Utility", () => {
  it("parses standard YouTube watch URLs", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({ type: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("parses YouTube Shorts URLs", () => {
    const result = parseVideoUrl("https://youtube.com/shorts/abcd1234efg");
    expect(result).toEqual({ type: "youtube", id: "abcd1234efg" });
  });

  it("parses YouTube Live URLs", () => {
    const result = parseVideoUrl("https://www.youtube.com/live/liveStream123");
    expect(result).toEqual({ type: "youtube", id: "liveStream123" });
  });

  it("parses YouTube short URLs (youtu.be)", () => {
    const result = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toEqual({ type: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("parses Vimeo video URLs", () => {
    const result = parseVideoUrl("https://vimeo.com/123456789");
    expect(result).toEqual({ type: "vimeo", id: "123456789" });
  });

  it("returns privacy-friendly embed URL for YouTube", () => {
    const embed = getEmbedUrl({ type: "youtube", id: "dQw4w9WgXcQ" });
    expect(embed).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("returns null for invalid video URLs", () => {
    expect(parseVideoUrl("invalid-url")).toBeNull();
    expect(parseVideoUrl("https://google.com")).toBeNull();
  });
});
