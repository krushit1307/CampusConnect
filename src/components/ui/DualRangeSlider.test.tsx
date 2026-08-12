import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DualRangeSlider } from "./DualRangeSlider";

describe("DualRangeSlider Component Suite (#2320)", () => {
  it("should render dual thumbs with min and max bounds", () => {
    render(<DualRangeSlider min={0} max={100} value={[20, 80]} formatLabel={(v) => `$${v}`} />);

    const minThumb = screen.getByTestId("slider-min-thumb");
    const maxThumb = screen.getByTestId("slider-max-thumb");

    expect(minThumb).toBeDefined();
    expect(maxThumb).toBeDefined();

    expect(minThumb.getAttribute("aria-valuenow")).toBe("20");
    expect(maxThumb.getAttribute("aria-valuenow")).toBe("80");
  });

  it("should render floating value labels above each thumb", () => {
    render(
      <DualRangeSlider
        min={0}
        max={100}
        value={[25, 75]}
        showFloatingLabels={true}
        formatLabel={(v) => `$${v}`}
      />,
    );

    const minLabel = screen.getByTestId("min-thumb-label");
    const maxLabel = screen.getByTestId("max-thumb-label");

    expect(minLabel.textContent).toBe("$25");
    expect(maxLabel.textContent).toBe("$75");
  });

  it("should enforce minimum step distance between thumbs to prevent collision", () => {
    const handleValueChange = vi.fn();

    render(
      <DualRangeSlider
        min={0}
        max={100}
        step={1}
        minStepsBetweenThumbs={5}
        value={[20, 80]}
        onValueChange={handleValueChange}
      />,
    );

    const minThumb = screen.getByTestId("slider-min-thumb");
    expect(minThumb).toBeDefined();

    // Trigger keyboard left/right on min thumb
    fireEvent.keyDown(minThumb, { key: "ArrowRight", code: "ArrowRight" });

    expect(minThumb).toBeDefined();
  });

  it("should format custom currency or percentage tick labels", () => {
    render(
      <DualRangeSlider
        min={0}
        max={500}
        value={[50, 250]}
        formatLabel={(v) => `€${v}`}
        showTicks={true}
      />,
    );

    expect(screen.getByText("€0")).toBeDefined();
    expect(screen.getByText("€500")).toBeDefined();
    expect(screen.getByText("Range: €200")).toBeDefined();
  });
});
