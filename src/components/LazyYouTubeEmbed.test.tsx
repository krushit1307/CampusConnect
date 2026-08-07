import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LazyYouTubeEmbed } from "./LazyYouTubeEmbed";

describe("LazyYouTubeEmbed Component (#2102)", () => {
  let observerCallback: (entries: IntersectionObserverEntry[]) => void;

  beforeEach(() => {
    vi.restoreAllMocks();

    class MockIntersectionObserver {
      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        observerCallback = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("renders lightweight placeholder with thumbnail and play button without iframe on initial render", () => {
    render(<LazyYouTubeEmbed videoId="dQw4w9WgXcQ" title="Test Video" />);

    // Zero iframe requests on initial load
    expect(screen.queryByTestId("youtube-iframe")).toBeNull();

    // Placeholder element renders with aspect-video class preventing CLS
    const container = screen.getByTestId("lazy-youtube-container");
    expect(container).toHaveClass("aspect-video");

    // Thumbnail image and fake play button present
    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    );

    const playButton = screen.getByTestId("fake-play-button");
    expect(playButton).toBeInTheDocument();
  });

  it("mounts YouTube iframe when placeholder enters viewport via Intersection Observer", () => {
    render(<LazyYouTubeEmbed videoId="dQw4w9WgXcQ" title="Test Video" />);

    expect(screen.queryByTestId("youtube-iframe")).toBeNull();

    // Simulate element scrolling into viewport inside act
    act(() => {
      observerCallback([
        {
          isIntersecting: true,
          target: document.createElement("div"),
        } as unknown as IntersectionObserverEntry,
      ]);
    });

    const iframe = screen.getByTestId("youtube-iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    );
  });

  it("mounts YouTube iframe immediately when user clicks the fake play button", () => {
    render(<LazyYouTubeEmbed videoId="dQw4w9WgXcQ" title="Test Video" />);

    expect(screen.queryByTestId("youtube-iframe")).toBeNull();

    const placeholder = screen.getByTestId("youtube-placeholder");
    fireEvent.click(placeholder);

    const iframe = screen.getByTestId("youtube-iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    );
  });

  it("returns null for invalid/empty video identifiers", () => {
    const { container } = render(<LazyYouTubeEmbed videoId="" url="invalid-url" />);
    expect(container.firstChild).toBeNull();
  });
});
