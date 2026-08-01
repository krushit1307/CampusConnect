// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LazyImage } from "./LazyImage";

describe("LazyImage Component", () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let intersectionCallback: (entries: Array<{ isIntersecting: boolean }>) => void;

  beforeEach(() => {
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    // Mock IntersectionObserver
    class MockIntersectionObserver {
      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
      constructor(
        callback: (entries: Array<{ isIntersecting: boolean }>) => void,
        _options?: IntersectionObserverInit,
      ) {
        intersectionCallback = callback;
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render the image initially and shows placeholder/skeleton", () => {
    render(
      <LazyImage src="https://example.com/image.jpg" alt="Test Image" data-testid="lazy-image" />,
    );

    // Actual image should not be in the DOM
    expect(screen.queryByAltText("Test Image")).not.toBeInTheDocument();

    // IntersectionObserver should be observing the element
    expect(observeMock).toHaveBeenCalledTimes(1);
  });

  it("renders the image when it intersects the viewport", () => {
    render(
      <LazyImage src="https://example.com/image.jpg" alt="Test Image" data-testid="lazy-image" />,
    );

    // Simulate intersection wrapped in act()
    act(() => {
      intersectionCallback([{ isIntersecting: true }]);
    });

    // Actual image should be rendered
    const image = screen.getByAltText("Test Image");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://example.com/image.jpg");

    // Observer should have disconnected after intersection
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
