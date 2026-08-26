import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SwipeToDelete from "./SwipeToDelete";

describe("SwipeToDelete Component", () => {
  const mockDelete = vi.fn();
  const mockVibrate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "vibrate", {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
  });

  it("renders children successfully", () => {
    render(
      <SwipeToDelete onDelete={mockDelete}>
        <div>Test Notification Card</div>
      </SwipeToDelete>,
    );

    expect(screen.getByText("Test Notification Card")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("handles gestures and pointer cancel state cleanly", () => {
    render(
      <SwipeToDelete onDelete={mockDelete}>
        <div>Card</div>
      </SwipeToDelete>,
    );

    const card = screen.getByText("Card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { clientX: 95, clientY: 100 }); // slight drag x
    fireEvent.pointerUp(card);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();
  });
});
