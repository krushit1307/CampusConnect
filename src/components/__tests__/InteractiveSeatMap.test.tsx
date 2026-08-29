import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { InteractiveSeatMap } from "../events/InteractiveSeatMap";
import { getEventSeats, lockSeatTemporarily } from "@/services/interactiveSeatMapService";

vi.mock("@/services/interactiveSeatMapService", async () => {
  const actual = await vi.importActual("@/services/interactiveSeatMapService");
  return {
    ...actual,
    getEventSeats: vi.fn(),
    lockSeatTemporarily: vi.fn(),
  };
});

describe("InteractiveSeatMap Component (#3873)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 2D auditorium SVG/grid layout with Stage banner", async () => {
    (getEventSeats as any).mockResolvedValue([]);

    render(<InteractiveSeatMap eventId="event-tedx-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("interactive-seat-map-container")).toBeInTheDocument();
      expect(screen.getByText(/STAGE \/ PERFORMANCE AREA/i)).toBeInTheDocument();
      expect(screen.getByTestId("seat-btn-Row-A-Seat-1")).toBeInTheDocument();
    });
  });

  it("locks seat and highlights selection green when an available seat is clicked", async () => {
    (getEventSeats as any).mockResolvedValue([]);
    (lockSeatTemporarily as any).mockResolvedValue({
      success: true,
      seat_id: "Row-A-Seat-1",
      seat_label: "Row A, Seat 1",
      status: "LOCKED",
    });

    const mockSeatSelected = vi.fn();

    render(<InteractiveSeatMap eventId="event-tedx-1" onSeatSelected={mockSeatSelected} />);

    await waitFor(() => {
      expect(screen.getByTestId("seat-btn-Row-A-Seat-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("seat-btn-Row-A-Seat-1"));

    await waitFor(() => {
      expect(lockSeatTemporarily).toHaveBeenCalledWith(
        "event-tedx-1",
        "Row-A-Seat-1",
        "Row A, Seat 1",
        "VIP",
        "user-current",
      );
      expect(mockSeatSelected).toHaveBeenCalledWith(
        expect.objectContaining({ seat_id: "Row-A-Seat-1", status: "SELECTED" }),
      );
      expect(screen.getByTestId("selected-seat-summary")).toBeInTheDocument();
      expect(screen.getByText(/Row A, Seat 1/i)).toBeInTheDocument();
    });
  });
});
