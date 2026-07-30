import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AnimatedTooltip } from "./AnimatedTooltip";

describe("AnimatedTooltip Component", () => {
  it("renders trigger children correctly", () => {
    render(
      <AnimatedTooltip content="Custom Radix Tooltip">
        <button>Hover Me</button>
      </AnimatedTooltip>,
    );

    expect(screen.getByText("Hover Me")).toBeInPrimary();
  });
});
