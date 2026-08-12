import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingSlider } from "./RatingSlider";

describe("RatingSlider Component Suite (#2215)", () => {
  it("renders with default min/max bounds and initial value", () => {
    render(<RatingSlider />);
    const slider = screen.getByRole("slider") as HTMLInputElement;

    expect(slider).toBeInTheDocument();
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("10");
  });

  it("updates expression label when slider value changes from low to high", () => {
    render(<RatingSlider />);
    const slider = screen.getByRole("slider");

    // Set rating to 1 (Angry)
    fireEvent.change(slider, { target: { value: "1" } });
    expect(screen.getByText(/1 - Angry/i)).toBeInTheDocument();

    // Set rating to 10 (Ecstatic)
    fireEvent.change(slider, { target: { value: "10" } });
    expect(screen.getByText(/10 - Ecstatic/i)).toBeInTheDocument();
  });

  it("triggers onChange callback with numeric rating value", () => {
    const handleChange = vi.fn();
    render(<RatingSlider onChange={handleChange} />);
    const slider = screen.getByRole("slider");

    fireEvent.change(slider, { target: { value: "8" } });
    expect(handleChange).toHaveBeenCalledWith(8);
  });
});
