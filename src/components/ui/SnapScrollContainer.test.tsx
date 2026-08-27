import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SnapScrollContainer, SnapSection } from "./SnapScrollContainer";
import { SnapNavigationDots } from "./SnapNavigationDots";

describe("SnapScrollContainer & SnapNavigationDots (#1741)", () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    window.IntersectionObserver = MockIntersectionObserver as any;
  });

  it("renders SnapScrollContainer with child snap sections", () => {
    render(
      <SnapScrollContainer sectionLabels={["Section 1", "Section 2"]}>
        <SnapSection id="sec-1">
          <div>Content Section 1</div>
        </SnapSection>
        <SnapSection id="sec-2">
          <div>Content Section 2</div>
        </SnapSection>
      </SnapScrollContainer>,
    );

    const sections = screen.getAllByTestId("snap-section");
    expect(sections.length).toBe(2);
    expect(sections[0].className).toContain("snap-start");
    expect(screen.getByText("Content Section 1")).toBeInTheDocument();
  });

  it("renders SnapNavigationDots with active section highlighted", () => {
    const handleSelect = vi.fn();
    render(
      <SnapNavigationDots
        totalSections={3}
        activeIndex={1}
        onSelectSection={handleSelect}
        sectionLabels={["Hero", "Feature 1", "Feature 2"]}
      />,
    );

    const dots = screen.getAllByRole("button");
    expect(dots.length).toBe(3);

    // Active dot has aria-current="step" and highlighted class
    expect(dots[1]).toHaveAttribute("aria-current", "step");
    expect(dots[1].className).toContain("bg-lime");

    // Click dot 2 calls onSelectSection(2)
    fireEvent.click(dots[2]);
    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(2);
  });
});
