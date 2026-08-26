import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { FilterSidebar } from "./FilterSidebar";

const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  return <div data-testid="probe">{decodeURIComponent(searchParams.toString())}</div>;
};

const renderFilterSidebar = (initialSearch = "") =>
  render(
    <MemoryRouter initialEntries={[`/clubs${initialSearch}`]}>
      <FilterSidebar availableTags={["Tech", "Music", "Art"]} />
      <SearchParamsProbe />
    </MemoryRouter>,
  );

describe("FilterSidebar (issue #2265)", () => {
  it("derives checkbox checked state strictly from the URL tags param", () => {
    renderFilterSidebar("?tags=Tech,Music");

    expect(screen.getByLabelText("Filter by tag Tech")).toBeChecked();
    expect(screen.getByLabelText("Filter by tag Music")).toBeChecked();
    expect(screen.getByLabelText("Filter by tag Art")).not.toBeChecked();
  });

  it("matches URL tags case-insensitively", () => {
    renderFilterSidebar("?tags=tech");

    expect(screen.getByLabelText("Filter by tag Tech")).toBeChecked();
    expect(screen.getByLabelText("Filter by tag Music")).not.toBeChecked();
  });

  it("appends a tag to the URL when a checkbox is toggled on", () => {
    renderFilterSidebar("?tags=Tech");

    fireEvent.click(screen.getByLabelText("Filter by tag Music"));

    expect(screen.getByLabelText("Filter by tag Music")).toBeChecked();
    expect(screen.getByTestId("probe").textContent).toBe("tags=Tech,Music");
  });

  it("removes a tag from the URL when a checkbox is toggled off", () => {
    renderFilterSidebar("?tags=Tech,Music");

    fireEvent.click(screen.getByLabelText("Filter by tag Music"));

    expect(screen.getByLabelText("Filter by tag Music")).not.toBeChecked();
    expect(screen.getByTestId("probe").textContent).toBe("tags=Tech");
  });

  it("deletes the tags param entirely when the last checkbox is toggled off", () => {
    renderFilterSidebar("?tags=Tech");

    fireEvent.click(screen.getByLabelText("Filter by tag Tech"));

    expect(screen.getByTestId("probe").textContent).toBe("");
  });

  it("clears all tags when the Clear button is clicked", () => {
    renderFilterSidebar("?tags=Tech,Music");

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));

    expect(screen.getByLabelText("Filter by tag Tech")).not.toBeChecked();
    expect(screen.getByLabelText("Filter by tag Music")).not.toBeChecked();
    expect(screen.getByTestId("probe").textContent).toBe("");
  });
});
