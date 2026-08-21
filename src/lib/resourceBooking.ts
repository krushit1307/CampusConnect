export interface SharedResource {
  id: string;
  name: string;
  type: string;
  quantity: number;
}

export interface ResourceBookingRecord {
  id: string;
  resourceId: string;
  clubId: string;
  eventId?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";
}

export const MANDATORY_BUFFER_MINUTES = 30;
export const MANDATORY_BUFFER_MS = MANDATORY_BUFFER_MINUTES * 60 * 1000;

/**
 * Checks if two booking time windows overlap, including the mandatory 30-minute buffer time.
 */
export function doBookingsOverlapWithBuffer(
  existingStartIso: string,
  existingEndIso: string,
  proposedStartIso: string,
  proposedEndIso: string,
): boolean {
  const existingStart = new Date(existingStartIso).getTime();
  const existingEndWithBuffer = new Date(existingEndIso).getTime() + MANDATORY_BUFFER_MS;

  const proposedStart = new Date(proposedStartIso).getTime();
  const proposedEnd = new Date(proposedEndIso).getTime();

  return proposedStart < existingEndWithBuffer && proposedEnd > existingStart;
}

/**
 * Validates a new booking request against existing approved reservations for a resource.
 */
export function validateBookingRequest(
  proposedBooking: Omit<ResourceBookingRecord, "id" | "status">,
  existingBookings: ResourceBookingRecord[],
): { isValid: boolean; conflictReason?: string } {
  const approvedForResource = existingBookings.filter(
    (b) => b.resourceId === proposedBooking.resourceId && b.status === "APPROVED",
  );

  for (const existing of approvedForResource) {
    if (
      doBookingsOverlapWithBuffer(
        existing.startTime,
        existing.endTime,
        proposedBooking.startTime,
        proposedBooking.endTime,
      )
    ) {
      return {
        isValid: false,
        conflictReason: `Resource is already booked during this window or within the mandatory ${MANDATORY_BUFFER_MINUTES}-minute transit buffer time.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Identifies overdue bookings that have passed their end_time but have not been marked as RETURNED.
 */
export function getOverdueBookings(
  bookings: ResourceBookingRecord[],
  nowMs: number = Date.now(),
): ResourceBookingRecord[] {
  return bookings.filter((b) => {
    if (b.status !== "APPROVED") return false;
    const endMs = new Date(b.endTime).getTime();
    return nowMs > endMs;
  });
}
