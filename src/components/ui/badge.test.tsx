import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders the default badge with base and default variant classes", () => {
    render(<Badge>Active</Badge>);

    const badge = screen.getByText("Active");

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("bg-primary");
    expect(badge).toHaveClass("text-primary-foreground");
  });

  it("renders the secondary variant", () => {
    render(<Badge variant="secondary">Draft</Badge>);

    const badge = screen.getByText("Draft");

    expect(badge).toHaveClass("bg-secondary");
    expect(badge).toHaveClass("text-secondary-foreground");
  });

  it("renders the destructive variant", () => {
    render(<Badge variant="destructive">Rejected</Badge>);

    const badge = screen.getByText("Rejected");

    expect(badge).toHaveClass("bg-destructive");
    expect(badge).toHaveClass("text-destructive-foreground");
  });

  it("supports outline variant and custom classes", () => {
    render(
      <Badge variant="outline" className="tracking-wide">
        Pending
      </Badge>,
    );

    const badge = screen.getByText("Pending");

    expect(badge).toHaveClass("text-foreground");
    expect(badge).toHaveClass("tracking-wide");
  });
});
