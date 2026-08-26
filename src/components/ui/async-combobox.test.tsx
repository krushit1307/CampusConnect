import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AsyncCombobox } from "./async-combobox";

interface MockUser {
  id: string;
  name: string;
}

const mockUsers: MockUser[] = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Jane Smith" },
  { id: "3", name: "Sam Wilson" },
];

describe("AsyncCombobox Component (#1735)", () => {
  it("renders input with proper combobox ARIA attributes", () => {
    render(
      <AsyncCombobox<MockUser>
        fetchOptions={vi.fn().mockResolvedValue([])}
        onSelect={vi.fn()}
        getOptionLabel={(u) => u.name}
        getOptionValue={(u) => u.id}
        placeholder="Type name..."
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("debounces API query by custom debounceMs before calling fetchOptions", async () => {
    const fetchOptionsMock = vi.fn().mockResolvedValue(mockUsers);

    render(
      <AsyncCombobox<MockUser>
        fetchOptions={fetchOptionsMock}
        onSelect={vi.fn()}
        getOptionLabel={(u) => u.name}
        getOptionValue={(u) => u.id}
        debounceMs={50}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "smi" } });

    // Should not have called immediately
    expect(fetchOptionsMock).not.toHaveBeenCalled();

    // Wait for 50ms debounce to complete
    await waitFor(() => {
      expect(fetchOptionsMock).toHaveBeenCalledTimes(1);
      expect(fetchOptionsMock).toHaveBeenCalledWith("smi", expect.any(AbortSignal));
    });
  });

  it("renders options with text highlighting when results arrive", async () => {
    const fetchOptionsMock = vi.fn().mockResolvedValue(mockUsers);

    render(
      <AsyncCombobox<MockUser>
        fetchOptions={fetchOptionsMock}
        onSelect={vi.fn()}
        getOptionLabel={(u) => u.name}
        getOptionValue={(u) => u.id}
        debounceMs={50}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "smi" } });

    await waitFor(() => {
      expect(screen.getAllByText("Smi").length).toBeGreaterThan(0);
    });

    const highlights = screen.getAllByText("Smi");
    expect(highlights[0].tagName).toBe("MARK");
  });

  it("supports keyboard navigation (ArrowDown, Enter) and calls onSelect", async () => {
    const handleSelect = vi.fn();
    const fetchOptionsMock = vi.fn().mockResolvedValue(mockUsers);

    render(
      <AsyncCombobox<MockUser>
        fetchOptions={fetchOptionsMock}
        onSelect={handleSelect}
        getOptionLabel={(u) => u.name}
        getOptionValue={(u) => u.id}
        debounceMs={50}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "smi" } });

    await waitFor(() => {
      expect(screen.getAllByText("Smi").length).toBeGreaterThan(0);
    });

    // Press ArrowDown to select first item
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Press Enter to confirm selection
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("closes dropdown list when Escape key is pressed", async () => {
    const fetchOptionsMock = vi.fn().mockResolvedValue(mockUsers);

    render(
      <AsyncCombobox<MockUser>
        fetchOptions={fetchOptionsMock}
        onSelect={vi.fn()}
        getOptionLabel={(u) => u.name}
        getOptionValue={(u) => u.id}
        debounceMs={50}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "smi" } });

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
