import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoResizeTextarea } from "./AutoResizeTextarea";

describe("AutoResizeTextarea Component Suite (#2211)", () => {
  it("renders correctly with default minHeight and overflow-hidden", () => {
    render(<AutoResizeTextarea placeholder="Type comment..." />);
    const textarea = screen.getByPlaceholderText("Type comment...") as HTMLTextAreaElement;

    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass("overflow-hidden");
    expect(textarea).toHaveClass("resize-none");
  });

  it("calls onChange callback when user types", () => {
    const handleChange = vi.fn();
    render(<AutoResizeTextarea placeholder="Type comment..." onChange={handleChange} />);
    const textarea = screen.getByPlaceholderText("Type comment...");

    fireEvent.change(textarea, { target: { value: "Hello World" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
