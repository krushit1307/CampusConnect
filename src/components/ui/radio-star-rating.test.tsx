import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RadioStarRating } from "./radio-star-rating";

afterEach(() => cleanup());

describe("RadioStarRating (issue #1900)", () => {
  it("renders a radiogroup with the default 'Rate this event' label", () => {
    render(<RadioStarRating value={0} onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-label", "Rate this event");
    expect(group).toHaveAttribute("aria-required", "true");
  });

  it("honours a custom aria-label override", () => {
    render(<RadioStarRating value={0} onChange={() => {}} label="Rate the venue" />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Rate the venue");
  });

  it("renders exactly 5 radio inputs by default", () => {
    render(<RadioStarRating value={0} onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("supports a custom max star count", () => {
    render(<RadioStarRating value={0} onChange={() => {}} max={10} />);
    expect(screen.getAllByRole("radio")).toHaveLength(10);
  });

  it("marks the radio matching `value` as checked and the others as unchecked", () => {
    render(<RadioStarRating value={3} onChange={() => {}} />);
    expect(screen.getByTestId("radio-star-input-1")).not.toBeChecked();
    expect(screen.getByTestId("radio-star-input-2")).not.toBeChecked();
    expect(screen.getByTestId("radio-star-input-3")).toBeChecked();
    expect(screen.getByTestId("radio-star-input-4")).not.toBeChecked();
    expect(screen.getByTestId("radio-star-input-5")).not.toBeChecked();
  });

  it("calls onChange with the picked star index when a radio is selected", () => {
    const onChange = vi.fn();
    render(<RadioStarRating value={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("radio-star-input-4"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("announces the current value to screen readers via per-input aria-label", () => {
    render(<RadioStarRating value={4} onChange={() => {}} />);
    // Per WAI-ARIA radio pattern, each radio's accessible name should be
    // its label (e.g. "4 out of 5 stars"). We assert the label text exists
    // so VoiceOver/NVDA can announce it.
    expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("1 out of 5 stars")).toBeInTheDocument();
  });

  it("supports arrow-key navigation between radios via native browser semantics", () => {
    // Native <input type="radio"> in a radiogroup responds to ArrowRight /
    // ArrowLeft to move focus and select the next/previous radio. We don't
    // implement this in JS — the browser does — but we verify the inputs
    // share a name so they form a single arrow-navigable group.
    render(<RadioStarRating value={3} onChange={() => {}} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    const names = new Set(radios.map((r) => r.name));
    expect(names.size).toBe(1); // one group -> one name
  });

  it("renders labels with a 44x44 minimum tap target for touch accessibility", () => {
    render(<RadioStarRating value={0} onChange={() => {}} />);
    for (let i = 1; i <= 5; i++) {
      const label = screen.getByTestId(`radio-star-${i}`);
      expect(label.className).toContain("min-h-[44px]");
      expect(label.className).toContain("min-w-[44px]");
    }
  });

  it("marks the filled star count as visually active (filled class) and the rest as muted", () => {
    render(<RadioStarRating value={3} onChange={() => {}} />);
    // Stars 1..3 should be filled (gold), 4..5 should be muted.
    for (let i = 1; i <= 3; i++) {
      const label = screen.getByTestId(`radio-star-${i}`);
      expect(label.querySelector("svg")?.className.baseVal || label.innerHTML).toContain(
        "fill-brand-orange-base",
      );
    }
    for (let i = 4; i <= 5; i++) {
      const label = screen.getByTestId(`radio-star-${i}`);
      expect(label.innerHTML).toContain("text-gray-300");
      expect(label.innerHTML).not.toContain("fill-brand-orange-base");
    }
  });

  it("hides the radio inputs visually via sr-only but keeps them focusable", () => {
    render(<RadioStarRating value={0} onChange={() => {}} />);
    const firstInput = screen.getByTestId("radio-star-input-1");
    expect(firstInput.className).toContain("sr-only");
    // It must not be display:none or visibility:hidden — sr-only is the
    // project's accessibility-preserving convention.
    expect(firstInput).not.toHaveAttribute("hidden");
  });

  it("only marks the first radio as required, not all of them", () => {
    render(<RadioStarRating value={0} onChange={() => {}} required />);
    expect(screen.getByTestId("radio-star-input-1")).toBeRequired();
    expect(screen.getByTestId("radio-star-input-2")).not.toBeRequired();
  });

  it("supports a custom `name` to share across radios for form submission", () => {
    render(<RadioStarRating value={2} onChange={() => {}} name="event-rating" />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    radios.forEach((r) => expect(r.name).toBe("event-rating"));
  });
});
