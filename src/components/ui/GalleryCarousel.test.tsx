import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GalleryCarousel, GallerySlide } from "./GalleryCarousel";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock embla-carousel-react
vi.mock("embla-carousel-react", () => ({
  default: () => [
    vi.fn(),
    {
      selectedScrollSnap: () => 0,
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      scrollTo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      plugins: () => ({
        autoplay: {
          play: vi.fn(),
          stop: vi.fn(),
        },
      }),
    },
  ],
}));

const mockSlides: GallerySlide[] = [
  { id: "1", imageUrl: "/img1.jpg", altText: "First event image" },
  { id: "2", imageUrl: "/img2.jpg", altText: "Second event image" },
];

describe("GalleryCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all slides with correct alt text", () => {
    render(<GalleryCarousel slides={mockSlides} />);

    expect(screen.getByAltText("First event image")).toBeInTheDocument();
    expect(screen.getByAltText("Second event image")).toBeInTheDocument();
  });

  it("renders pause button with correct initial aria-label", () => {
    render(<GalleryCarousel slides={mockSlides} />);

    const pauseButton = screen.getByRole("button", { name: /pause slideshow/i });
    expect(pauseButton).toBeInTheDocument();
    expect(pauseButton).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles pause state when pause button is clicked", () => {
    render(<GalleryCarousel slides={mockSlides} />);

    const pauseButton = screen.getByRole("button", { name: /pause slideshow/i });
    fireEvent.click(pauseButton);

    expect(screen.getByRole("button", { name: /play slideshow/i })).toBeInTheDocument();
  });

  it("respects prefers-reduced-motion by disabling autoplay", () => {
    // Mock matchMedia for reduced motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<GalleryCarousel slides={mockSlides} />);

    // Progress bar should be at 100% immediately
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });
});
