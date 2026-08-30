import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProfileCompletionAvatar } from "./ProfileCompletionAvatar";

const getCircles = (container: HTMLElement) => container.querySelectorAll("svg circle");

describe("ProfileCompletionAvatar (#2389)", () => {
  it("renders a user menu trigger with the ring SVG and initials", () => {
    const { container } = render(<ProfileCompletionAvatar initials="S" percentage={50} />);

    const trigger = screen.getByRole("button", { name: /user menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("title", "Profile 50% complete");
    expect(screen.getByText("S")).toBeInTheDocument();

    // Background track + animated fill
    expect(getCircles(container)).toHaveLength(2);
  });

  it("starts empty on mount: dashoffset equals full circumference at 0%", () => {
    const { container } = render(<ProfileCompletionAvatar initials="S" percentage={75} />);

    const fill = getCircles(container)[1];
    const radius = Number(fill.getAttribute("r"));
    const circumference = 2 * Math.PI * radius;

    // Before the animation timer fires, the ring must be completely empty.
    expect(Number(fill.getAttribute("stroke-dasharray"))).toBeCloseTo(circumference);
    expect(Number(fill.getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference);
  });

  it("animates to the requested percentage after mount", async () => {
    const { container } = render(<ProfileCompletionAvatar initials="S" percentage={50} />);

    const fill = getCircles(container)[1];
    const circumference = 2 * Math.PI * Number(fill.getAttribute("r"));

    await waitFor(
      () => {
        const offset = Number(fill.getAttribute("stroke-dashoffset"));
        expect(offset).toBeCloseTo(circumference - 0.5 * circumference, 5);
      },
      { timeout: 1000 },
    );
  });

  it("reaches a perfect unbroken circle at 100%", async () => {
    const { container } = render(<ProfileCompletionAvatar initials="S" percentage={100} />);

    const fill = getCircles(container)[1];
    const circumference = 2 * Math.PI * Number(fill.getAttribute("r"));

    await waitFor(
      () => {
        expect(Number(fill.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 5);
        expect(circumference).toBeGreaterThan(0);
      },
      { timeout: 1000 },
    );
  });

  it("keeps round endcaps inside the viewBox (no clipping)", () => {
    const { container } = render(<ProfileCompletionAvatar initials="S" percentage={80} />);

    const svg = container.querySelector("svg")!;
    const fill = getCircles(container)[1];
    const size = 40;
    const strokeWidth = 3;
    const radius = Number(fill.getAttribute("r"));

    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${size} ${size}`);
    expect(radius + strokeWidth / 2).toBeLessThanOrEqual(size / 2);
    expect(fill.getAttribute("stroke-linecap")).toBe("round");
  });
});
