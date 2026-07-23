import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders the default button with base and default variant classes", () => {
    render(<Button>Save changes</Button>);

    const button = screen.getByRole("button", { name: /save changes/i });

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("inline-flex");
    expect(button).toHaveClass("bg-primary");
    expect(button).toHaveClass("text-primary-foreground");
  });

  it("renders the destructive variant", () => {
    render(<Button variant="destructive">Delete event</Button>);

    const button = screen.getByRole("button", { name: /delete event/i });

    expect(button).toHaveClass("bg-destructive");
    expect(button).toHaveClass("text-destructive-foreground");
  });

  it("renders secondary and outline variants with their expected classes", () => {
    render(
      <>
        <Button variant="secondary">Secondary action</Button>
        <Button variant="outline">Outline action</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: /secondary action/i })).toHaveClass("bg-secondary");
    expect(screen.getByRole("button", { name: /outline action/i })).toHaveClass("bg-white");
  });

  it("supports disabled state and custom classes", () => {
    render(
      <Button disabled className="w-full">
        Disabled action
      </Button>,
    );

    const button = screen.getByRole("button", { name: /disabled action/i });

    expect(button).toBeDisabled();
    expect(button).toHaveClass("w-full");
  });

  it("forwards refs to the underlying button element", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Focusable button</Button>);

    expect(ref.current).toBe(screen.getByRole("button", { name: /focusable button/i }));
  });
});
