/**
 * Ticket Validation Service
 * Handles API requests for validating QR code ticket UUIDs.
 */
export interface TicketValidationResponse {
  isValid: boolean;
  message: string;
  attendeeName?: string;
  eventName?: string;
}

export const validateTicket = async (ticketId: string): Promise<TicketValidationResponse> => {
  try {
    // Validate UUID format before making network request
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ticketId)) {
      return {
        isValid: false,
        message: "Invalid ticket format.",
      };
    }

    const response = await fetch(`/api/tickets/validate?id=${encodeURIComponent(ticketId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        isValid: false,
        message: errorData.message || "Ticket validation failed.",
      };
    }

    const data = await response.json();
    return {
      isValid: true,
      message: "Ticket validated successfully.",
      attendeeName: data.attendeeName,
      eventName: data.eventName,
    };
  } catch (error) {
    console.error("Ticket validation error:", error);
    return {
      isValid: false,
      message: "Network error during validation.",
    };
  }
};
