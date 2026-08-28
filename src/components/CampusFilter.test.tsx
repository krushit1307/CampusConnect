import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CampusFilter } from "./CampusFilter";

describe("CampusFilter (#3846)", () => {
  const unsortedCampuses = [
    "Vancouver",
    "Toronto",
    "Calgary",
    "Montreal",
    "Edmonton",
    "Ottawa",
  ];

  it("sorts the campuses alphabetically before rendering", () => {
    const handleCampusChange = vi.fn();
    render(
      <CampusFilter
        campuses={unsortedCampuses}
        selectedCampus="all"
        onCampusChange={handleCampusChange}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();

    // Verify sorted order: Calgary, Edmonton, Montreal, Ottawa, Toronto, Vancouver
    const expectedSorted = [...unsortedCampuses].sort((a, b) => a.localeCompare(b));
    expect(expectedSorted).toEqual([
      "Calgary",
      "Edmonton",
      "Montreal",
      "Ottawa",
      "Toronto",
      "Vancouver",
    ]);
  });
});
