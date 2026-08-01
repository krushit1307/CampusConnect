import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { VideoThumbnail } from "./VideoThumbnail";

const THUMB = "https://cdn.example.com/events/recording-thumb.jpg";
const PREVIEW = "https://cdn.example.com/events/recording-preview.webm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VideoThumbnail (issue #1908)", () => {
  beforeEach(() => {
    // jsdom does not implement matchMedia; stub hover-capable to true by
    // default so the video layer is rendered. Per-test overrides can flip
    // matches to false to simulate touch-only devices.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders the static thumbnail", () => {
    render(
      <VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Hackathon 2026 recording" />,
    );
    expect(screen.getByAltText("Hackathon 2026 recording")).toBeInTheDocument();
    expect(screen.getByAltText("Hackathon 2026 recording").getAttribute("src")).toBe(THUMB);
  });

  it("renders the video preview tag on hover-capable devices", () => {
    render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
    const video = screen.getByTestId("video-preview");
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe(PREVIEW);
    // muted / loop / playsinline are boolean props on <video>; jsdom renders
    // them as empty attributes. We check the property (truthy) instead of
    // the attribute so the assertion is robust across React versions.
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect((video as HTMLVideoElement).loop).toBe(true);
    expect((video as HTMLVideoElement).playsInline).toBe(true);
    // Initial state: video is paused + opacity 0 (hidden).
    expect(video.className).toContain("opacity-0");
  });

  it("calls video.play() on mouseenter and video.pause() on mouseleave", () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();

    // jsdom HTMLVideoElement doesn't implement play/pause; install spies.
    const origPlay = HTMLVideoElement.prototype.play;
    const origPause = HTMLVideoElement.prototype.pause;
    HTMLVideoElement.prototype.play = playSpy;
    HTMLVideoElement.prototype.pause = pauseSpy;

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const root = screen.getByTestId("video-thumbnail");

      act(() => {
        fireEvent.mouseEnter(root);
      });
      expect(playSpy).toHaveBeenCalledTimes(1);

      act(() => {
        fireEvent.mouseLeave(root);
      });
      expect(pauseSpy).toHaveBeenCalledTimes(1);
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
      HTMLVideoElement.prototype.pause = origPause;
    }
  });

  it("resets currentTime to 0 on mouseenter so each hover starts at t=0", () => {
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const video = screen.getByTestId("video-preview") as HTMLVideoElement;
      const root = screen.getByTestId("video-thumbnail");

      // Simulate the video having played to the middle.
      video.currentTime = 5;

      act(() => {
        fireEvent.mouseEnter(root);
      });

      expect(video.currentTime).toBe(0);
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
    }
  });

  it("resets currentTime to 0 on mouseleave so the next hover starts fresh", () => {
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const video = screen.getByTestId("video-preview") as HTMLVideoElement;
      const root = screen.getByTestId("video-thumbnail");

      act(() => {
        fireEvent.mouseEnter(root);
      });
      video.currentTime = 3;

      act(() => {
        fireEvent.mouseLeave(root);
      });

      expect(video.currentTime).toBe(0);
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
    }
  });

  it("swaps the video opacity to 100 on hover and back to 0 on leave", () => {
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const video = screen.getByTestId("video-preview");
      const root = screen.getByTestId("video-thumbnail");

      act(() => {
        fireEvent.mouseEnter(root);
      });
      expect(video.className).toContain("opacity-100");

      act(() => {
        fireEvent.mouseLeave(root);
      });
      expect(video.className).toContain("opacity-0");
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
    }
  });

  it("hides the play badge while the preview is playing", () => {
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const root = screen.getByTestId("video-thumbnail");

      // Badge visible at rest.
      expect(screen.getByText(/Hover to preview/i)).toBeInTheDocument();

      act(() => {
        fireEvent.mouseEnter(root);
      });

      // Badge fades out while the preview plays.
      const badge = screen.getByText(/Hover to preview/i).parentElement;
      expect(badge?.className).toContain("opacity-0");
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
    }
  });

  it("renders as an <a> tag when href is supplied", () => {
    render(
      <VideoThumbnail
        thumbnailUrl={THUMB}
        previewUrl={PREVIEW}
        alt="Recording"
        href="/events/123/replay"
      />,
    );
    const link = screen.getByTestId("video-thumbnail");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/events/123/replay");
  });

  it("does NOT render the <video> tag at all on touch-only devices (mobile edge case)", () => {
    // Force hover-capable to false just for this test.
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: false, // touch-only device
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );

    render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
    expect(screen.queryByTestId("video-preview")).not.toBeInTheDocument();
    // Thumbnail is still shown.
    expect(screen.getByAltText("Recording")).toBeInTheDocument();
  });

  it("responds to keyboard focus the same as hover (a11y parity)", () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();
    const origPlay = HTMLVideoElement.prototype.play;
    const origPause = HTMLVideoElement.prototype.pause;
    HTMLVideoElement.prototype.play = playSpy;
    HTMLVideoElement.prototype.pause = pauseSpy;

    try {
      render(
        <VideoThumbnail
          thumbnailUrl={THUMB}
          previewUrl={PREVIEW}
          alt="Recording"
          href="/events/123"
        />,
      );
      const link = screen.getByTestId("video-thumbnail");
      act(() => {
        link.focus();
        fireEvent.focus(link);
      });
      expect(playSpy).toHaveBeenCalled();

      act(() => {
        fireEvent.blur(link);
      });
      expect(pauseSpy).toHaveBeenCalled();
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
      HTMLVideoElement.prototype.pause = origPause;
    }
  });

  it("uses preload='none' so hover-capable devices don't prefetch the video bytes", () => {
    render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
    expect(screen.getByTestId("video-preview")).toHaveAttribute("preload", "none");
  });

  it("swallows play() promise rejections (autoplay can be blocked)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = vi.fn().mockRejectedValue(new Error("autoplay blocked"));

    try {
      render(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Recording" />);
      const root = screen.getByTestId("video-thumbnail");

      // Should not throw, should not surface the error to the user.
      expect(() => {
        act(() => {
          fireEvent.mouseEnter(root);
        });
      }).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      HTMLVideoElement.prototype.play = origPlay;
    }
  });
});
