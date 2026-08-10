import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import VideoScrubber from "./VideoScrubber";

describe("VideoScrubber Component (#2431)", () => {
  it("renders scrubber bar correctly", () => {
    render(<VideoScrubber progress={10} duration={100} onSeek={vi.fn()} />);
    expect(screen.getByTestId("video-scrubber-bar")).toBeInTheDocument();
  });

  it("calculates thumbnail index and displays hover tooltip on mouse move", () => {
    render(
      <VideoScrubber
        progress={0}
        duration={100}
        spriteUrl="https://example.com/spritesheet.jpg"
        onSeek={vi.fn()}
      />,
    );

    const bar = screen.getByTestId("video-scrubber-bar");
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseMove(bar, { clientX: 100 });

    const tooltip = screen.getByTestId("video-scrubber-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText("0:50")).toBeInTheDocument();

    const spriteDiv = screen.getByTestId("scrubber-thumbnail-sprite");
    expect(spriteDiv).toHaveStyle("background-image: url(https://example.com/spritesheet.jpg)");
  });

  it("triggers onSeek with exact timestamp when clicked", () => {
    const onSeekMock = vi.fn();
    render(<VideoScrubber progress={0} duration={120} onSeek={onSeekMock} />);

    const bar = screen.getByTestId("video-scrubber-bar");
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 20,
      right: 400,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.click(bar, { clientX: 300 });

    expect(onSeekMock).toHaveBeenCalledWith(90);
  });

  it("supports touch events for mobile scrubbing", () => {
    const onSeekMock = vi.fn();
    render(<VideoScrubber progress={0} duration={100} onSeek={onSeekMock} />);

    const bar = screen.getByTestId("video-scrubber-bar");
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.touchStart(bar, { touches: [{ clientX: 50 }] });
    expect(screen.getByTestId("video-scrubber-tooltip")).toBeInTheDocument();

    fireEvent.touchEnd(bar);
    expect(onSeekMock).toHaveBeenCalledWith(25);
  });
});
