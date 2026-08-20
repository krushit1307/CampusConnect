export interface OverflowVenueConfig {
  id: string;
  venueName: string; // e.g. "Video Overflow Room 204"
  capacity: number;
}

export interface PrimaryEventCapacityConfig {
  eventId: string;
  primaryVenueName: string; // e.g. "Main Auditorium"
  primaryCapacity: number;
  overflowVenues: OverflowVenueConfig[];
}

export interface ExistingRsvpTierCount {
  tier: "MAIN" | "OVERFLOW";
  venueName: string;
  count: number;
}

export interface TicketReservationResult {
  tier: "MAIN" | "OVERFLOW";
  assignedVenueName: string;
  displayMessage: string;
  isOverflow: boolean;
}

export interface TicketQrPayload {
  eventId: string;
  userId: string;
  tier: "MAIN" | "OVERFLOW";
  allowedVenueName: string;
  qrSignature: string;
}

/**
 * Determines appropriate venue tier allocation for new RSVP requests.
 */
export function allocateVenueTierForRsvp(
  config: PrimaryEventCapacityConfig,
  currentCounts: ExistingRsvpTierCount[],
): TicketReservationResult {
  const mainCountItem = currentCounts.find(
    (c) => c.tier === "MAIN" && c.venueName === config.primaryVenueName,
  );
  const currentMainCount = mainCountItem ? mainCountItem.count : 0;

  // 1. Check Primary Venue availability
  if (currentMainCount < config.primaryCapacity) {
    return {
      tier: "MAIN",
      assignedVenueName: config.primaryVenueName,
      displayMessage: `Confirmed seat in ${config.primaryVenueName}.`,
      isOverflow: false,
    };
  }

  // 2. Cascade into Overflow Venues
  for (const overflow of config.overflowVenues) {
    const overflowCountItem = currentCounts.find(
      (c) => c.tier === "OVERFLOW" && c.venueName === overflow.venueName,
    );
    const currentOverflowCount = overflowCountItem ? overflowCountItem.count : 0;

    if (currentOverflowCount < overflow.capacity) {
      return {
        tier: "OVERFLOW",
        assignedVenueName: overflow.venueName,
        displayMessage: `${config.primaryVenueName} is Full. You are reserving a seat in the ${overflow.venueName}.`,
        isOverflow: true,
      };
    }
  }

  throw new Error("Main room and all overflow rooms are at 100% capacity.");
}

/**
 * Generates room-specific QR code payloads ensuring overflow ticket holders cannot access main room.
 */
export function generateVenueTierQrPayload(
  eventId: string,
  userId: string,
  tier: "MAIN" | "OVERFLOW",
  assignedVenueName: string,
): TicketQrPayload {
  const signatureSeed = `${eventId}:${userId}:${tier}:${assignedVenueName}`.toUpperCase();
  // Simple Base64 signature simulation
  const qrSignature = btoa(signatureSeed);

  return {
    eventId,
    userId,
    tier,
    allowedVenueName: assignedVenueName,
    qrSignature,
  };
}
