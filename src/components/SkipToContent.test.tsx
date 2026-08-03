import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkipToContent } from "./SkipToContent";

describe("SkipToContent Component", () => {
  it("renders skip to main content link with correct target href", () => {
    render(<SkipToContent />);

    const link = screen.getByRole("link", { name: /skip to main content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("includes screen reader accessibility classes", () => {
    render(<SkipToContent />);

    const link = screen.getByRole("link", { name: /skip to main content/i });
    expect(link.className).toContain("sr-only");
  });
});
