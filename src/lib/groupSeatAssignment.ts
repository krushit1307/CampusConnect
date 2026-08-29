export interface VenueSeat {
  seatId: string;
  rowLabel: string;
  seatNumber: number;
  isReserved: boolean;
  reservedByGroup?: string;
}

export interface VenueRow {
  rowLabel: string;
  rowIndex: number;
  seats: VenueSeat[];
}

export interface SeatAssignmentResult {
  success: boolean;
  groupSize: number;
  assignedSeats: { rowLabel: string; seatNumber: number; seatId: string }[];
  isContiguous: boolean;
  isSplit: boolean;
  warningMessage?: string;
}

/**
 * Searches for a contiguous block of available seats in a single row (#4272).
 */
export function findContiguousRowSeats(
  rows: VenueRow[],
  groupSize: number
): { rowLabel: string; seats: VenueSeat[] } | null {
  for (const row of rows) {
    let currentConsecutive: VenueSeat[] = [];

    for (const seat of row.seats) {
      if (!seat.isReserved) {
        currentConsecutive.push(seat);
        if (currentConsecutive.length === groupSize) {
          return {
            rowLabel: row.rowLabel,
            seats: [...currentConsecutive],
          };
        }
      } else {
        currentConsecutive = [];
      }
    }
  }

  return null;
}

/**
 * Splits group seating logically across adjacent rows when no single row fits the entire group (#4272).
 */
export function findSplitRowSeats(
  rows: VenueRow[],
  groupSize: number
): { assignedSeats: VenueSeat[]; warningMessage: string } | null {
  const availableSeats: VenueSeat[] = [];

  // Gather available seats starting from front rows
  for (const row of rows) {
    for (const seat of row.seats) {
      if (!seat.isReserved) {
        availableSeats.push(seat);
        if (availableSeats.length === groupSize) break;
      }
    }
    if (availableSeats.length === groupSize) break;
  }

  if (availableSeats.length < groupSize) {
    return null; // Not enough total capacity
  }

  // Count breakdown by row for clear user notice
  const rowCounts = new Map<string, number>();
  availableSeats.forEach((s) => {
    rowCounts.set(s.rowLabel, (rowCounts.get(s.rowLabel) || 0) + 1);
  });

  const breakdown = Array.from(rowCounts.entries())
    .map(([rowLabel, count]) => `${count} seat${count > 1 ? "s" : ""} in Row ${rowLabel}`)
    .join(" and ");

  const warningMessage = `⚠️ Split Seating Notice: No single row has ${groupSize} contiguous seats. Assigned ${breakdown} directly behind.`;

  return {
    assignedSeats: availableSeats,
    warningMessage,
  };
}

/**
 * Main entry point for Group RSVP seat allocation (#4272).
 */
export function assignGroupSeats(
  seatingChart: VenueRow[],
  groupSize: number
): SeatAssignmentResult {
  if (groupSize <= 0) {
    return {
      success: false,
      groupSize,
      assignedSeats: [],
      isContiguous: false,
      isSplit: false,
      warningMessage: "Invalid group size requested.",
    };
  }

  // 1. Attempt contiguous block in a single row
  const contiguousMatch = findContiguousRowSeats(seatingChart, groupSize);
  if (contiguousMatch) {
    return {
      success: true,
      groupSize,
      assignedSeats: contiguousMatch.seats.map((s) => ({
        rowLabel: s.rowLabel,
        seatNumber: s.seatNumber,
        seatId: s.seatId,
      })),
      isContiguous: true,
      isSplit: false,
    };
  }

  // 2. Fallback: Logical split seating across adjacent rows
  const splitMatch = findSplitRowSeats(seatingChart, groupSize);
  if (splitMatch) {
    return {
      success: true,
      groupSize,
      assignedSeats: splitMatch.assignedSeats.map((s) => ({
        rowLabel: s.rowLabel,
        seatNumber: s.seatNumber,
        seatId: s.seatId,
      })),
      isContiguous: false,
      isSplit: true,
      warningMessage: splitMatch.warningMessage,
    };
  }

  // 3. Insufficient seats available in venue
  return {
    success: false,
    groupSize,
    assignedSeats: [],
    isContiguous: false,
    isSplit: false,
    warningMessage: `Sold Out: Unable to find ${groupSize} available seats in the venue.`,
  };
}
