import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MapToggle } from "../src/components/CampusMap/MapToggle";

describe("MapToggle Component", () => {
  it("renders both buttons", () => {
    const { getByText } = render(<MapToggle view="pins" onToggle={vi.fn()} />);
    expect(getByText("Pins")).toBeDefined();
    expect(getByText("Heatmap")).toBeDefined();
  });

  it("calls onToggle when a different view is clicked", () => {
    const onToggleMock = vi.fn();
    const { getByText } = render(<MapToggle view="pins" onToggle={onToggleMock} />);

    // Clicking Heatmap should trigger toggle
    fireEvent.click(getByText("Heatmap"));
    expect(onToggleMock).toHaveBeenCalledTimes(1);

    // Clicking Pins while already on Pins should NOT trigger toggle
    fireEvent.click(getByText("Pins"));
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });
});
