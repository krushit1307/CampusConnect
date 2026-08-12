import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("renders a textbox with the default input classes", () => {
    render(<Input aria-label="Club name" placeholder="Enter club name" />);

    const input = screen.getByRole("textbox", { name: /club name/i });

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Enter club name");
    expect(input).toHaveClass("flex");
    expect(input).toHaveClass("border-input");
  });

  it("supports disabled state", () => {
    render(<Input aria-label="Disabled field" disabled />);

    const input = screen.getByRole("textbox", { name: /disabled field/i });

    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:opacity-50");
  });

  it("supports custom input types and classes", () => {
    render(<Input aria-label="Email address" type="email" className="max-w-sm" />);

    const input = screen.getByRole("textbox", { name: /email address/i });

    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveClass("max-w-sm");
  });

  it("forwards refs to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>();

    render(<Input ref={ref} aria-label="Forwarded input" />);

    expect(ref.current).toBe(screen.getByRole("textbox", { name: /forwarded input/i }));
  });
});
