import { describe, it, expect } from "vitest";
import {
  findContiguousRowSeats,
  findSplitRowSeats,
  assignGroupSeats,
  VenueRow,
} from "./groupSeatAssignment";

describe("Group RSVP Seat Assignment Engine Utility (#4272)", () => {
  const mockChartContiguous: VenueRow[] = [
    {
      rowLabel: "A",
      rowIndex: 0,
      seats: [
        { seatId: "A-1", rowLabel: "A", seatNumber: 1, isReserved: false },
        { seatId: "A-2", rowLabel: "A", seatNumber: 2, isReserved: false },
        { seatId: "A-3", rowLabel: "A", seatNumber: 3, isReserved: false },
        { seatId: "A-4", rowLabel: "A", seatNumber: 4, isReserved: false },
        { seatId: "A-5", rowLabel: "A", seatNumber: 5, isReserved: false },
      ],
    },
    {
      rowLabel: "B",
      rowIndex: 1,
      seats: [
        { seatId: "B-1", rowLabel: "B", seatNumber: 1, isReserved: true },
        { seatId: "B-2", rowLabel: "B", seatNumber: 2, isReserved: false },
      ],
    },
  ];

  const mockChartScattered: VenueRow[] = [
    {
      rowLabel: "A",
      rowIndex: 0,
      seats: [
        { seatId: "A-1", rowLabel: "A", seatNumber: 1, isReserved: false },
        { seatId: "A-2", rowLabel: "A", seatNumber: 2, isReserved: false },
        { seatId: "A-3", rowLabel: "A", seatNumber: 3, isReserved: true }, // Gap!
        { seatId: "A-4", rowLabel: "A", seatNumber: 4, isReserved: false },
      ],
    },
    {
      rowLabel: "B",
      rowIndex: 1,
      seats: [
        { seatId: "B-1", rowLabel: "B", seatNumber: 1, isReserved: false },
        { seatId: "B-2", rowLabel: "B", seatNumber: 2, isReserved: false },
      ],
    },
  ];

  it("assigns contiguous seats in a single row for Group RSVP of 5", () => {
    const res = assignGroupSeats(mockChartContiguous, 5);

    expect(res.success).toBe(true);
    expect(res.isContiguous).toBe(true);
    expect(res.isSplit).toBe(false);
    expect(res.assignedSeats).toHaveLength(5);
    expect(res.assignedSeats.every((s) => s.rowLabel === "A")).toBe(true);
  });

  it("falls back to logical split seating and generates warning notice when single row cannot fit 4 seats", () => {
    const res = assignGroupSeats(mockChartScattered, 4);

    expect(res.success).toBe(true);
    expect(res.isContiguous).toBe(false);
    expect(res.isSplit).toBe(true);
    expect(res.warningMessage).toContain("Split Seating Notice");
    expect(res.assignedSeats).toHaveLength(4);
  });

  it("returns failure when venue has insufficient total capacity", () => {
    const res = assignGroupSeats(mockChartScattered, 20);

    expect(res.success).toBe(false);
    expect(res.warningMessage).toContain("Sold Out");
  });
});
