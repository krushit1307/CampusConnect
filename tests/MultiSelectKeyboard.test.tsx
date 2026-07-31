import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, describe } from "vitest";
import { MultiSelect, Tag } from "../components/MultiSelect";
import "@testing-library/jest-dom";

const options: Tag[] = [
  { value: "music", label: "Music" },
  { value: "tech", label: "Tech" },
  { value: "sports", label: "Sports" },
];

window.HTMLElement.prototype.scrollIntoView = vi.fn();

function TestWrapper() {
  const [selected, setSelected] = useState<Tag[]>([]);
  return (
    <MultiSelect
      options={options}
      value={selected}
      onChange={setSelected}
      placeholder="Select tags"
    />
  );
}

describe("MultiSelect Keyboard Navigation", () => {
  test("Backspace on trigger removes last selected tag", () => {
    render(<TestWrapper />);
    const trigger = screen.getByRole("combobox");

    // Select via click first
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Music"));

    expect(screen.getByText("Music", { selector: "span.truncate" })).toBeInTheDocument();

    // Press backspace on trigger
    fireEvent.keyDown(trigger, { key: "Backspace", code: "Backspace" });

    // Verify removed
    expect(screen.queryByText("Music", { selector: "span.truncate" })).not.toBeInTheDocument();
  });
});
