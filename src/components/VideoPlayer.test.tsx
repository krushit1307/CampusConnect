import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { VideoPlayer } from "./VideoPlayer";

const SRC = "https://cdn.example.com/clubs/promo.mp4";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  Object.defineProperty(document, "pictureInPictureEnabled", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(document, "pictureInPictureElement", {
    value: null,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VideoPlayer (issue #2273)", () => {
  it("renders custom branded controls with native controls hidden", () => {
    const { container } = render(<VideoPlayer src={SRC} />);

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.hasAttribute("controls")).toBe(false);
  });

  it("shows the center play overlay when paused and fades it out when playing", () => {
    const { container } = render(<VideoPlayer src={SRC} />);
    const overlay = screen.getByTestId("video-center-play-overlay");

    expect(overlay.className).toContain("opacity-100");

    const video = container.querySelector("video");
    fireEvent.play(video!);

    expect(overlay.className).toContain("opacity-0");
    expect(overlay.className).toContain("pointer-events-none");
  });

  it("plays the video when the center overlay button is clicked", () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.play = playSpy;

    render(<VideoPlayer src={SRC} />);
    const overlay = screen.getByTestId("video-center-play-overlay");

    fireEvent.click(within(overlay).getByRole("button"));

    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("enters picture-in-picture when the PiP button is clicked", () => {
    const requestPiPSpy = vi.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.requestPictureInPicture = requestPiPSpy;

    render(<VideoPlayer src={SRC} />);
    const pipButton = screen.getByRole("button", { name: "Enter picture in picture" });

    fireEvent.click(pipButton);

    expect(requestPiPSpy).toHaveBeenCalledTimes(1);
  });

  it("exits picture-in-picture when PiP is already active", () => {
    const exitPiPSpy = vi.fn().mockResolvedValue(undefined);
    document.exitPictureInPicture = exitPiPSpy;

    const { container } = render(<VideoPlayer src={SRC} />);
    const video = container.querySelector("video");
    Object.defineProperty(document, "pictureInPictureElement", {
      value: video,
      configurable: true,
    });

    const pipButton = screen.getByRole("button", { name: "Enter picture in picture" });
    fireEvent.click(pipButton);

    expect(exitPiPSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the PiP button label in sync with native PiP events", () => {
    const { container } = render(<VideoPlayer src={SRC} />);
    const video = container.querySelector("video");

    fireEvent(video!, new Event("enterpictureinpicture"));
    expect(screen.getByRole("button", { name: "Exit picture in picture" })).toBeInTheDocument();

    fireEvent(video!, new Event("leavepictureinpicture"));
    expect(screen.getByRole("button", { name: "Enter picture in picture" })).toBeInTheDocument();
  });

  it("syncs fullscreen state when the browser exits via the ESC key", () => {
    render(<VideoPlayer src={SRC} />);
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();

    Object.defineProperty(document, "fullscreenElement", {
      value: {},
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument();

    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();
  });

  it("does not render the PiP button when the browser does not support PiP", () => {
    Object.defineProperty(document, "pictureInPictureEnabled", {
      value: false,
      configurable: true,
    });

    render(<VideoPlayer src={SRC} />);
    expect(
      screen.queryByRole("button", { name: "Enter picture in picture" }),
    ).not.toBeInTheDocument();
  });
});
