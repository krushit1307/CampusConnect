import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TagMultiSelect } from "./TagMultiSelect";

describe("TagMultiSelect Component", () => {
  it("renders selected tags as dismissible pills", () => {
    render(
      <TagMultiSelect
        value={["Tech", "Career"]}
        onChange={vi.fn()}
        placeholder="Select or type tags..."
      />,
    );

    expect(screen.getByText("#Tech")).toBeInTheDocument();
    expect(screen.getByText("#Career")).toBeInTheDocument();
  });

  it("filters dropdown options when typing in input", () => {
    render(
      <TagMultiSelect
        value={[]}
        onChange={vi.fn()}
        options={["Tech", "Career", "Food", "Workshop"]}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Work" } });

    expect(screen.getByText("#Workshop")).toBeInTheDocument();
    expect(screen.queryByText("#Tech")).not.toBeInTheDocument();
  });

  it("selects a tag when clicking an option from dropdown", () => {
    const onChange = vi.fn();
    render(<TagMultiSelect value={[]} onChange={onChange} options={["Tech", "Career", "Food"]} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    const option = screen.getByText("#Tech");
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith(["Tech"]);
  });

  it("removes a tag pill when clicking the remove button", () => {
    const onChange = vi.fn();
    render(<TagMultiSelect value={["Tech", "Career"]} onChange={onChange} />);

    const removeTechBtn = screen.getByRole("button", { name: /remove tag tech/i });
    fireEvent.click(removeTechBtn);

    expect(onChange).toHaveBeenCalledWith(["Career"]);
  });

  it("removes last tag on backspace when input is empty", () => {
    const onChange = vi.fn();
    render(<TagMultiSelect value={["Tech", "Career"]} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["Tech"]);
  });

  it("allows creating a custom tag when typing and pressing Enter", () => {
    const onChange = vi.fn();
    render(
      <TagMultiSelect
        value={["Tech"]}
        onChange={onChange}
        options={["Tech", "Career"]}
        allowCustomTags={true}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "AI-Innovation" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Tech", "AI-Innovation"]);
  });
});
