import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Parallax3DCard } from "./Parallax3DCard";

vi.mock("framer-motion", () => ({
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useMotionValue: (init: number) => ({
    get: () => init,
    set: vi.fn(),
    onChange: vi.fn(),
  }),
  useSpring: (v: unknown) => v,
  useTransform: (v: unknown, input: number[], output: (string | number)[]) => ({
    get: () => output[0] ?? 0,
  }),
}));

describe("Parallax3DCard component (#1685)", () => {
  beforeEach(() => {
    // Mock matchMedia for hover capability
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("hover: hover"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders children properly", () => {
    render(
      <Parallax3DCard data-testid="parallax-container">
        <div>Card Content</div>
      </Parallax3DCard>,
    );

    expect(screen.getByTestId("parallax-container")).toBeInTheDocument();
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  it("renders glare overlay when glareEnable is true", () => {
    render(
      <Parallax3DCard glareEnable={true}>
        <div>Card Content</div>
      </Parallax3DCard>,
    );

    expect(screen.getByTestId("parallax-glare")).toBeInTheDocument();
  });

  it("handles mouse enter, move, and leave events cleanly", () => {
    render(
      <Parallax3DCard data-testid="parallax-card">
        <div>Interactive Content</div>
      </Parallax3DCard>,
    );

    const card = screen.getByTestId("parallax-card");
    const motionDiv = card.firstElementChild || card;

    fireEvent.mouseEnter(motionDiv);
    fireEvent.mouseMove(motionDiv, { clientX: 100, clientY: 100 });
    fireEvent.mouseLeave(motionDiv);

    expect(screen.getByText("Interactive Content")).toBeInTheDocument();
  });

  it("disables 3D effect when matchMedia returns false for hover capability", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <Parallax3DCard data-testid="parallax-static">
        <div>Static Mobile Content</div>
      </Parallax3DCard>,
    );

    expect(screen.getByTestId("parallax-static")).toBeInTheDocument();
    expect(screen.queryByTestId("parallax-glare")).not.toBeInTheDocument();
  });
});
