import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { VideoEmbed } from "./VideoEmbed";

describe("VideoEmbed Component", () => {
  beforeEach(() => {
    // Mock IntersectionObserver for Vitest DOM environment
    class MockIntersectionObserver {
      callback: (entries: IntersectionObserverEntry[]) => void;
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        this.callback = callback;
      }
      observe() {
        this.callback([
          {
            isIntersecting: true,
            target: document.createElement("div"),
          } as unknown as IntersectionObserverEntry,
        ]);
      }
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("returns null for unparseable invalid URLs", () => {
    const { container } = render(<VideoEmbed url="invalid-url" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders lazy iframe with correct embed URL when visible", () => {
    render(<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);

    const iframe = screen.getByTitle("Embedded video");
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toContain("dQw4w9WgXcQ");
  });
});
