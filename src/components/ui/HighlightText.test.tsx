import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HighlightText } from "./HighlightText";

describe("HighlightText Component (#1735)", () => {
  it("renders plain text when highlight query is empty", () => {
    render(<HighlightText text="John Smith" highlight="" />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("case-insensitively highlights matching substring", () => {
    render(<HighlightText text="John Smith" highlight="smi" />);
    const match = screen.getByText("Smi");
    expect(match.tagName).toBe("MARK");
    expect(screen.getByText(/John/)).toBeInTheDocument();
    expect(screen.getByText(/th/)).toBeInTheDocument();
  });

  it("handles special regex characters safely", () => {
    render(<HighlightText text="User (Admin) [Dev]" highlight="(Admin)" />);
    const match = screen.getByText("(Admin)");
    expect(match.tagName).toBe("MARK");
  });

  it("renders multiple matching occurrences", () => {
    render(<HighlightText text="Banana" highlight="a" />);
    const matches = screen.getAllByText("a");
    expect(matches.length).toBe(3);
    matches.forEach((m) => expect(m.tagName).toBe("MARK"));
  });
});
