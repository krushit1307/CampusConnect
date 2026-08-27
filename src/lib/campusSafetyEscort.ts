export interface EscortRequestInput {
  eventId: string;
  userId: string;
  phoneNumber: string;
  destination: string;
  latitude: number;
  longitude: number;
  eventEndTimeIso: string;
}

export interface DispatchWebhookPayload {
  requestId: string;
  studentUserId: string;
  callbackPhone: string;
  dropoffDestination: string;
  gpsCoordinates: {
    lat: number;
    lng: number;
  };
  dispatchTimestamp: string;
}

export interface SafetyEscortRecord {
  id: string;
  eventId: string;
  userId: string;
  phoneNumber: string;
  destination: string;
  latitude: number;
  longitude: number;
  status: "REQUESTED" | "DISPATCHED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  etaMinutes: number;
  createdAt: string;
}

export const LATE_NIGHT_HOUR_THRESHOLD = 21; // 9:00 PM (21:00)

/**
 * Checks if an event qualifies for the persistent "Request SafeWalk" button (ends after 9:00 PM).
 */
export function isLateNightEvent(eventEndTimeIso: string): boolean {
  const date = new Date(eventEndTimeIso);
  const hour = date.getHours();
  return hour >= LATE_NIGHT_HOUR_THRESHOLD || hour < 5; // 9 PM to 5 AM
}

/**
 * Validates request payload parameters and GPS coordinates before dispatch.
 */
export function validateEscortRequestInput(input: EscortRequestInput): {
  isValid: boolean;
  error?: string;
} {
  if (!isLateNightEvent(input.eventEndTimeIso)) {
    return {
      isValid: false,
      error:
        "SafeWalk escort requests are only available for late-night events ending after 9:00 PM.",
    };
  }

  if (!input.destination || input.destination.trim().length === 0) {
    return { isValid: false, error: "Destination location is required." };
  }

  if (!input.phoneNumber || input.phoneNumber.trim().length < 7) {
    return { isValid: false, error: "A valid phone number is required for dispatch updates." };
  }

  if (
    typeof input.latitude !== "number" ||
    typeof input.longitude !== "number" ||
    Math.abs(input.latitude) > 90 ||
    Math.abs(input.longitude) > 180
  ) {
    return { isValid: false, error: "Invalid GPS coordinates." };
  }

  return { isValid: true };
}

/**
 * Formats the payload for the University Campus Security / SafeWalk dispatch API webhook.
 */
export function formatDispatchWebhookPayload(
  requestId: string,
  input: EscortRequestInput,
  nowIso: string = new Date().toISOString(),
): DispatchWebhookPayload {
  return {
    requestId,
    studentUserId: input.userId,
    callbackPhone: input.phoneNumber,
    dropoffDestination: input.destination,
    gpsCoordinates: {
      lat: input.latitude,
      lng: input.longitude,
    },
    dispatchTimestamp: nowIso,
  };
}

/**
 * Cancels an active safety escort request in case the student finds a friend to walk with.
 */
export function cancelEscortRequest(record: SafetyEscortRecord): SafetyEscortRecord {
  if (record.status === "COMPLETED" || record.status === "CANCELLED") {
    throw new Error(`Cannot cancel a request that is already ${record.status}.`);
  }

  return {
    ...record,
    status: "CANCELLED",
  };
}
