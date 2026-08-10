import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FlipCard } from "./FlipCard";

describe("FlipCard (#2324)", () => {
  it("renders both the front and back faces", () => {
    render(<FlipCard front={<p>Front face</p>} back={<p>Back face</p>} />);
    expect(screen.getByText("Front face")).toBeInTheDocument();
    expect(screen.getByText("Back face")).toBeInTheDocument();
  });

  it("starts unflipped with aria-pressed set to false", () => {
    const { container } = render(<FlipCard front={<p>F</p>} back={<p>B</p>} />);
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveClass("flip-card-is-flipped");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles flipped state and aria-pressed on click", () => {
    const { container } = render(<FlipCard front={<p>F</p>} back={<p>B</p>} />);
    const card = container.firstChild as HTMLElement;
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(card).toHaveClass("flip-card-is-flipped");
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(card).not.toHaveClass("flip-card-is-flipped");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes the aria-label and forwards custom attributes", () => {
    const { container } = render(
      <FlipCard
        front={<p>F</p>}
        back={<p>B</p>}
        ariaLabel="Jane Doe's bio"
        className="h-40 w-40"
        data-testid="officer-card"
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Jane Doe's bio");
    expect(container.firstChild).toHaveClass("h-40", "w-40", "flip-card");
    expect(container.firstChild).toHaveAttribute("data-testid", "officer-card");
  });
});
