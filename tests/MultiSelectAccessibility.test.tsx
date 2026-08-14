import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, describe } from "vitest";
import { MultiSelect, Tag } from "../components/MultiSelect";
import "@testing-library/jest-dom";

const options: Tag[] = [
  { value: "1", label: "One" },
  { value: "2", label: "Two" },
];

function TestWrapper() {
  const [selected, setSelected] = useState<Tag[]>([{ value: "1", label: "One" }]);
  return (
    <MultiSelect
      options={options}
      value={selected}
      onChange={setSelected}
      placeholder="Select tags"
    />
  );
}

describe("MultiSelect Accessibility", () => {
  test("combobox has correct roles and attributes", () => {
    render(<TestWrapper />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const removeBtn = screen.getByLabelText("Remove tag One");
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn).toHaveAttribute("type", "button");
  });
});
