import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  GroupSeatAssignmentWidget,
  MOCK_AUDITORIUM_CHART,
} from "./GroupSeatAssignmentWidget";

describe("GroupSeatAssignmentWidget Component (#4272)", () => {
  it("renders Group Seat Assignment header, seating chart matrix, and group tickets input", () => {
    render(
      <GroupSeatAssignmentWidget
        eventTitle="Annual Campus Comedy Night"
        initialSeatingChart={MOCK_AUDITORIUM_CHART}
      />
    );

    expect(screen.getByText(/Dynamic "Group RSVP" Seat Assignment — Annual Campus Comedy Night/i)).toBeInTheDocument();
    expect(screen.getByText(/STAGE \/ PERFORMANCE AREA/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Group Tickets:/i)).toBeInTheDocument();
  });

  it("displays Contiguous Seating Reserved badge when group fits in single row", () => {
    render(
      <GroupSeatAssignmentWidget
        eventTitle="Annual Campus Comedy Night"
        initialSeatingChart={MOCK_AUDITORIUM_CHART}
      />
    );

    expect(screen.getByText(/Contiguous Seating Reserved/i)).toBeInTheDocument();
    expect(screen.getByText(/All 5 members sit together in a single row/i)).toBeInTheDocument();
  });

  it("displays Split Seating Notice warning when group size requires splitting across rows", () => {
    render(
      <GroupSeatAssignmentWidget
        eventTitle="Annual Campus Comedy Night"
        initialSeatingChart={MOCK_AUDITORIUM_CHART}
      />
    );

    const input = screen.getByLabelText(/Group Tickets:/i);
    fireEvent.change(input, { target: { value: "8" } });

    expect(screen.getAllByText(/Split Seating Notice/i).length).toBeGreaterThan(0);
  });

  it("confirms group RSVP reservation on action button click", () => {
    const handleConfirm = vi.fn();
    render(
      <GroupSeatAssignmentWidget
        eventTitle="Annual Campus Comedy Night"
        initialSeatingChart={MOCK_AUDITORIUM_CHART}
        onConfirmReservation={handleConfirm}
      />
    );

    const lockBtn = screen.getByRole("button", { name: /Lock & Confirm Group RSVP/i });
    fireEvent.click(lockBtn);

    expect(handleConfirm).toHaveBeenCalled();
  });
});
