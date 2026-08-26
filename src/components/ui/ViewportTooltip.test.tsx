import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ViewportTooltip } from "./ViewportTooltip";

describe("ViewportTooltip Component (#1962)", () => {
  it("renders trigger element", () => {
    render(
      <ViewportTooltip content="Helper text">
        <button>Hover me</button>
      </ViewportTooltip>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("shows tooltip content on hover after delay", async () => {
    render(
      <ViewportTooltip content="Detailed info text" delay={10}>
        <button>Hover me</button>
      </ViewportTooltip>,
    );

    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Detailed info text")).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <ViewportTooltip content="Detailed info text" delay={10}>
        <button>Hover me</button>
      </ViewportTooltip>,
    );

    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
