import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AuditoriumMap, type AuditoriumSeat } from "./AuditoriumMap";

describe("AuditoriumMap Component (#2227)", () => {
  const mockSeats: AuditoriumSeat[] = [
    { id: "A1", label: "A1", row: "A", number: 1, x: 50, y: 100 },
    { id: "A2", label: "A2", row: "A", number: 2, x: 90, y: 100 },
    { id: "B1", label: "B1", row: "B", number: 1, x: 50, y: 140 },
  ];

  it("renders seating chart with stage and seat elements having unique IDs", () => {
    render(<AuditoriumMap seats={mockSeats} />);

    expect(screen.getByTestId("auditorium-stage")).toBeInTheDocument();
    expect(screen.getByTestId("seat-A1")).toBeInTheDocument();
    expect(screen.getByTestId("seat-A2")).toBeInTheDocument();
    expect(screen.getByTestId("seat-B1")).toBeInTheDocument();

    const seatA1 = screen.getByTestId("seat-A1");
    expect(seatA1.getAttribute("id")).toBe("seat-A1");
  });

  it("allows selecting an available seat (Seat A1)", () => {
    const handleSeatSelect = vi.fn();
    render(<AuditoriumMap seats={mockSeats} onSeatSelect={handleSeatSelect} />);

    const seatA1 = screen.getByTestId("seat-A1");
    expect(seatA1.getAttribute("class")).toContain("fill-emerald-500");

    fireEvent.click(seatA1);
    expect(handleSeatSelect).toHaveBeenCalledWith("A1");
  });

  it("renders selected seat with highlighted brand styling", () => {
    render(<AuditoriumMap seats={mockSeats} selectedSeats={["A1"]} />);

    const seatA1 = screen.getByTestId("seat-A1");
    expect(seatA1.getAttribute("class")).toContain("fill-blue-600");
  });

  it("applies pointer-events-none and grey fill for sold seats (soldSeatIds)", () => {
    const handleSeatSelect = vi.fn();
    render(
      <AuditoriumMap seats={mockSeats} soldSeatIds={["A1"]} onSeatSelect={handleSeatSelect} />,
    );

    const seatA1 = screen.getByTestId("seat-A1");
    expect(seatA1.getAttribute("class")).toContain("fill-gray-400");
    expect(seatA1.getAttribute("class")).toContain("pointer-events-none");

    fireEvent.click(seatA1);
    expect(handleSeatSelect).not.toHaveBeenCalled();
  });
});
