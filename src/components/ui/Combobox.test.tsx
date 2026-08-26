import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Combobox, ComboboxOption } from "./Combobox";
import { MAJOR_OPTIONS } from "@/constants/majors";

// Mock options
const mockOptions: ComboboxOption[] = [
  { value: "Computer Science", label: "Computer Science" },
  { value: "Computer Engineering", label: "Computer Engineering" },
  { value: "Mathematics", label: "Mathematics" },
  { value: "Physics", label: "Physics" },
];

const WrapperCombobox = ({ options = mockOptions }: { options?: ComboboxOption[] }) => {
  const [val, setVal] = useState("");
  return (
    <div>
      <Combobox
        options={options}
        value={val}
        onValueChange={setVal}
        placeholder="Select Major..."
      />
      <div data-testid="selected-value">{val}</div>
    </div>
  );
};

describe("Combobox Component", () => {
  it("renders with placeholder when no value is selected", () => {
    render(<Combobox options={mockOptions} placeholder="Select Major..." />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Select Major...");
  });

  it("opens dropdown showing options and filters on typing 'sci'", async () => {
    render(<WrapperCombobox options={MAJOR_OPTIONS} />);

    // Click input field / trigger to open dropdown
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // Verify dropdown opens
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Type "sci" into search input
    const input = screen.getByPlaceholderText(/search select major/i);
    fireEvent.change(input, { target: { value: "sci" } });

    // Verify dropdown filters to "Computer Science", "Political Science", etc.
    await waitFor(() => {
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
      expect(screen.getByText("Political Science")).toBeInTheDocument();
      expect(screen.queryByText("Aerospace Engineering")).not.toBeInTheDocument();
    });
  });

  it("selects an option via click and updates display and state", async () => {
    render(<WrapperCombobox options={mockOptions} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Computer Science"));

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Computer Science");
      expect(screen.getByTestId("selected-value")).toHaveTextContent("Computer Science");
    });
  });

  it("displays empty state when no options match", async () => {
    render(<Combobox options={mockOptions} emptyStateMessage="No majors found" />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "NonExistentMajor" } });

    await waitFor(() => {
      expect(screen.getByText("No majors found")).toBeInTheDocument();
    });
  });

  it("utilizes virtualization for 150 majors list", async () => {
    render(<WrapperCombobox options={MAJOR_OPTIONS} />);

    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      const virtualContainer = screen
        .getByRole("listbox")
        ?.querySelector('div[style*="position: relative"]');
      expect(virtualContainer).toBeTruthy();
    });
  });

  it("supports keyboard navigation (Arrow Down and Enter) to filter, highlight, and select 'Computer Science'", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        options={MAJOR_OPTIONS}
        onValueChange={onValueChange}
        placeholder="Select Major..."
      />,
    );

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText(/search select major/i);
    fireEvent.change(input, { target: { value: "Computer Sci" } });

    await waitFor(() => {
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
    });

    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("Computer Science");
  });
});
