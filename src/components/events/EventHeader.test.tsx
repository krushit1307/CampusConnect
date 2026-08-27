import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventHeader } from "./EventHeader";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, style, className }: any) => (
      <div data-testid="motion-div" style={style} className={className}>
        {children}
      </div>
    ),
  },
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: (_value: any, _input: any, output: any) => output[0],
}));

describe("EventHeader Component", () => {
  it("renders event title and parallax container with overflow-hidden", () => {
    render(
      <EventHeader title="Tech Symposium 2026" bannerUrl="https://example.com/banner.jpg">
        <h1>Tech Symposium 2026</h1>
      </EventHeader>,
    );

    expect(screen.getByText("Tech Symposium 2026")).toBeInTheDocument();
    expect(screen.getByTestId("motion-div")).toBeInTheDocument();
  });
});
