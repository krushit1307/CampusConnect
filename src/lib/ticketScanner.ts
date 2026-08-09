export interface ScannedTicketPayload {
  ticketId: string;
  eventId: string;
  attendeeId: string;
  timestamp: number;
}

export interface TicketScanResult {
  status: "VALID" | "DUPLICATE" | "INVALID";
  ticketId?: string;
  attendeeId?: string;
  message: string;
}

/**
 * Parses raw scanned QR string into structured ticket data.
 */
export function parseTicketQrCode(qrData: string): ScannedTicketPayload | null {
  try {
    const parsed = JSON.parse(qrData);
    if (!parsed.ticketId || !parsed.eventId || !parsed.attendeeId) {
      return null;
    }
    return parsed as ScannedTicketPayload;
  } catch {
    return null;
  }
}

/**
 * Triggers device haptic feedback if supported.
 */
export function triggerHapticFeedback(type: "success" | "error"): void {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    if (type === "success") {
      navigator.vibrate([100, 50, 100]); // Short double buzz for success
    } else {
      navigator.vibrate([300, 100, 300]); // Long double buzz for error
    }
  }
}

/**
 * Processes scanned ticket against cached or database state.
 */
export function processTicketScan(qrData: string, scannedTicketIds: Set<string>): TicketScanResult {
  const payload = parseTicketQrCode(qrData);

  if (!payload) {
    triggerHapticFeedback("error");
    return {
      status: "INVALID",
      message: "Invalid ticket QR code format.",
    };
  }

  if (scannedTicketIds.has(payload.ticketId)) {
    triggerHapticFeedback("error");
    return {
      status: "DUPLICATE",
      ticketId: payload.ticketId,
      attendeeId: payload.attendeeId,
      message: "Ticket has already been scanned!",
    };
  }

  // Mark ticket as scanned
  scannedTicketIds.add(payload.ticketId);
  triggerHapticFeedback("success");

  return {
    status: "VALID",
    ticketId: payload.ticketId,
    attendeeId: payload.attendeeId,
    message: "Ticket verified successfully!",
  };
}
