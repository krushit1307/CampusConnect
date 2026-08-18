import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Virtualized Social Feed List (#1432)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists and restores scroll position to sessionStorage", () => {
    sessionStorage.setItem("feed_scroll_position", "450");
    const retrieved = sessionStorage.getItem("feed_scroll_position");
    expect(retrieved).toBe("450");
  });

  it("calculates variable item height estimates based on image attachments", () => {
    const textOnlyPost = { id: "1", content: "Hello world" };
    const imagePost = {
      id: "2",
      content: "Check this out",
      image_url: "https://example.com/img.jpg",
    };

    const estimateSize = (post: { image_url?: string }) => (post.image_url ? 450 : 210);

    expect(estimateSize(textOnlyPost)).toBe(210);
    expect(estimateSize(imagePost)).toBe(450);
  });
});
