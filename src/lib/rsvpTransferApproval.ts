export interface TransferRequestItem {
  id: string;
  eventId: string;
  originalUserId: string;
  originalUserName: string;
  targetUserId?: string;
  targetUserName?: string;
  status: "pending" | "approved" | "rejected";
  createdAtIso: string;
}

export interface WaitlistCandidate {
  userId: string;
  userName: string;
  joinedWaitlistAtIso: string;
  notes?: string;
}

export interface TransferProcessingResult {
  shouldAutoSellToWaitlist: boolean;
  createTransferRequest: boolean;
  message: string;
}

/**
 * Determines whether ticket return triggers automatic waitlist promotion or organizer transfer review.
 */
export function processTicketReturnFlow(
  requiresTransferApproval: boolean,
  eventId: string,
  originalUserId: string,
): TransferProcessingResult {
  if (requiresTransferApproval) {
    return {
      shouldAutoSellToWaitlist: false,
      createTransferRequest: true,
      message:
        "Ticket return submitted. Manual approval is required by the organizer before reallocation.",
    };
  }

  return {
    shouldAutoSellToWaitlist: true,
    createTransferRequest: false,
    message: "Ticket returned. Position automatically offered to the next waitlist candidate.",
  };
}

/**
 * Executes organizer manual ticket grant decision.
 */
export function approveManualTicketGrant(
  request: TransferRequestItem,
  selectedCandidate: WaitlistCandidate,
): { updatedRequest: TransferRequestItem; transferPayload: Record<string, string> } {
  return {
    updatedRequest: {
      ...request,
      targetUserId: selectedCandidate.userId,
      targetUserName: selectedCandidate.userName,
      status: "approved",
    },
    transferPayload: {
      requestId: request.id,
      eventId: request.eventId,
      fromUserId: request.originalUserId,
      toUserId: selectedCandidate.userId,
    },
  };
}
