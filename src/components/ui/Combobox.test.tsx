import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Combobox, ComboboxOption } from "./Combobox";

// Mock data
const mockOptions: ComboboxOption[] = [
  { value: "cs", label: "Computer Science" },
  { value: "ce", label: "Computer Engineering" },
  { value: "math", label: "Mathematics" },
  { value: "phys", label: "Physics" },
];

// Generate 150 options to test virtualization path
const largeMockOptions: ComboboxOption[] = Array.from({ length: 150 }, (_, i) => ({
  value: `opt-${i}`,
  label: `Option ${i}`,
}));

describe("Combobox Component", () => {
  it("renders with placeholder when no value is selected", () => {
    render(<Combobox options={mockOptions} placeholder="Select Major..." />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Select Major...");
  });

  it("opens dropdown and filters options on typing", async () => {
    render(<Combobox options={mockOptions} placeholder="Select Major..." />);

    // Open dropdown
    fireEvent.click(screen.getByRole("combobox"));

    // Type to filter
    const input = screen.getByPlaceholderText(/search select major/i);
    fireEvent.change(input, { target: { value: "Comp" } });

    // Verify filtered results
    await waitFor(() => {
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
      expect(screen.getByText("Computer Engineering")).toBeInTheDocument();
      expect(screen.queryByText("Mathematics")).not.toBeInTheDocument();
    });
  });

  it("selects an option and updates display", async () => {
    const onValueChange = vi.fn();
    render(<Combobox options={mockOptions} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Computer Science"));

    expect(onValueChange).toHaveBeenCalledWith("cs");
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Computer Science");
    });
  });

  it("displays empty state when no options match", async () => {
    render(<Combobox options={mockOptions} emptyStateMessage="No majors found" />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "Biology" } });

    await waitFor(() => {
      expect(screen.getByText("No majors found")).toBeInTheDocument();
    });
  });

  it("utilizes virtualization for large lists (>100 items)", async () => {
    render(<Combobox options={largeMockOptions} />);

    fireEvent.click(screen.getByRole("combobox"));

    // In virtualized mode, not all 150 items are in the DOM immediately.
    // We check for the presence of the virtualized container structure.
    await waitFor(() => {
      const virtualContainer = screen
        .getByRole("listbox")
        ?.querySelector('div[style*="position: absolute"]');
      // The virtualizer renders a wrapper with absolute positioning for items
      expect(virtualContainer).toBeTruthy();
    });
  });

  it("supports keyboard navigation (Arrow Down and Enter)", async () => {
    const onValueChange = vi.fn();
    render(<Combobox options={mockOptions} onValueChange={onValueChange} />);

    const combobox = screen.getByRole("combobox");
    fireEvent.click(combobox);

    // Focus the input inside the popover
    const input = screen.getByPlaceholderText(/search/i);
    input.focus();

    // Arrow down to highlight second option
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to select
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("ce"); // Computer Engineering
  });
});
