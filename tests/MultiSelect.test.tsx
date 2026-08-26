import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
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

describe("MultiSelect Component", () => {
  test("renders correctly with placeholder", () => {
    render(<TestWrapper />);
    expect(screen.getByText("Select tags")).toBeInTheDocument();
  });

  test("selects and removes a tag", () => {
    render(<TestWrapper />);

    // Open popover
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // Select "Music"
    const musicOption = screen.getByText("Music");
    fireEvent.click(musicOption);

    // Verify "Music" pill is added
    const musicPill = screen.getByText("Music", { selector: "span.truncate" });
    expect(musicPill).toBeInTheDocument();

    // Select "Tech"
    const techOption = screen.getByText("Tech");
    fireEvent.click(techOption);

    // Verify both are present
    expect(screen.getByText("Tech", { selector: "span.truncate" })).toBeInTheDocument();

    // Remove "Music"
    const removeBtn = screen.getByLabelText("Remove tag Music");
    fireEvent.click(removeBtn);

    // Verify "Music" is removed
    expect(screen.queryByText("Music", { selector: "span.truncate" })).not.toBeInTheDocument();

    // Tech should still be there
    expect(screen.getByText("Tech", { selector: "span.truncate" })).toBeInTheDocument();
  });
});
