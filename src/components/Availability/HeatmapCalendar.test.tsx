import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeatmapCalendar } from "./HeatmapCalendar";

// Fix "today" so weekday/date labels and the isToday highlight are deterministic.
const FIXED_MONDAY = new Date("2026-08-10T00:00:00");

function getSlot(day: number, hour: number) {
  return screen.getByTestId(`slot-${day}-${hour}`);
}

describe("HeatmapCalendar", () => {
  it("renders a 7 (days) x 24 (hours) grid of slots", () => {
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} />);
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        expect(getSlot(day, hour)).toBeInTheDocument();
      }
    }
  });

  it("paints a swath of empty slots green on drag", () => {
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} />);

    fireEvent.mouseDown(getSlot(0, 9));
    fireEvent.mouseEnter(getSlot(0, 10));
    fireEvent.mouseEnter(getSlot(0, 11));
    fireEvent.mouseUp(window);

    expect(getSlot(0, 9)).toHaveClass("bg-green-500");
    expect(getSlot(0, 10)).toHaveClass("bg-green-500");
    expect(getSlot(0, 11)).toHaveClass("bg-green-500");
    // Untouched slot stays empty.
    expect(getSlot(0, 12)).not.toHaveClass("bg-green-500");
  });

  it("locks a stroke into erase mode when it starts on an already-green slot", () => {
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} />);

    // Paint a block of slots first.
    fireEvent.mouseDown(getSlot(1, 9));
    fireEvent.mouseEnter(getSlot(1, 10));
    fireEvent.mouseEnter(getSlot(1, 11));
    fireEvent.mouseUp(window);
    expect(getSlot(1, 9)).toHaveClass("bg-green-500");
    expect(getSlot(1, 10)).toHaveClass("bg-green-500");
    expect(getSlot(1, 11)).toHaveClass("bg-green-500");

    // Start the next drag ON an already-green slot, then sweep across both
    // green and empty cells. The whole stroke must stay in erase mode —
    // it should NOT re-paint the empty cell it crosses.
    fireEvent.mouseDown(getSlot(1, 9));
    fireEvent.mouseEnter(getSlot(1, 10));
    fireEvent.mouseEnter(getSlot(1, 12)); // was never painted
    fireEvent.mouseUp(window);

    expect(getSlot(1, 9)).not.toHaveClass("bg-green-500");
    expect(getSlot(1, 10)).not.toHaveClass("bg-green-500");
    expect(getSlot(1, 11)).toHaveClass("bg-green-500"); // never entered this stroke, still green
    expect(getSlot(1, 12)).not.toHaveClass("bg-green-500"); // erase mode locked, not painted
  });

  it("stops updating cells once mouseup fires on window, even outside the grid", () => {
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} />);

    fireEvent.mouseDown(getSlot(2, 9));
    fireEvent.mouseUp(window); // released outside/anywhere
    fireEvent.mouseEnter(getSlot(2, 10)); // should be a no-op now

    expect(getSlot(2, 9)).toHaveClass("bg-green-500");
    expect(getSlot(2, 10)).not.toHaveClass("bg-green-500");
  });

  it("serializes selected slots into an array of ISO timestamps on save", () => {
    const onSubmit = vi.fn();
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} onSubmit={onSubmit} />);

    fireEvent.mouseDown(getSlot(0, 9));
    fireEvent.mouseUp(window);
    fireEvent.click(screen.getByTestId("save-availability"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [saved] = onSubmit.mock.calls[0];
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toHaveLength(1);
    expect(() => new Date(saved[0]).toISOString()).not.toThrow();
  });

  it("clears all selected slots", () => {
    render(<HeatmapCalendar weekOf={FIXED_MONDAY} />);

    fireEvent.mouseDown(getSlot(3, 9));
    fireEvent.mouseEnter(getSlot(3, 10));
    fireEvent.mouseUp(window);
    expect(getSlot(3, 9)).toHaveClass("bg-green-500");

    fireEvent.click(screen.getByTestId("clear-slots"));

    expect(getSlot(3, 9)).not.toHaveClass("bg-green-500");
    expect(getSlot(3, 10)).not.toHaveClass("bg-green-500");
  });
});
