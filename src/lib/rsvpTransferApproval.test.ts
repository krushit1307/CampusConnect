import { describe, it, expect } from "vitest";
import {
  processTicketReturnFlow,
  approveManualTicketGrant,
  TransferRequestItem,
  WaitlistCandidate,
} from "./rsvpTransferApproval";

describe("Dynamic Event RSVP Transfer Approvals Suite (#4400)", () => {
  it("bypasses auto waitlist promotion when requires_transfer_approval is true", () => {
    const result = processTicketReturnFlow(true, "evt_vip_dinner", "usr_alice");

    expect(result.shouldAutoSellToWaitlist).toBe(false);
    expect(result.createTransferRequest).toBe(true);
    expect(result.message).toContain("Manual approval is required");
  });

  it("triggers automatic waitlist promotion when requires_transfer_approval is false", () => {
    const result = processTicketReturnFlow(false, "evt_public_concert", "usr_bob");

    expect(result.shouldAutoSellToWaitlist).toBe(true);
    expect(result.createTransferRequest).toBe(false);
  });

  it("processes manual organizer grant to a specific candidate from the waitlist", () => {
    const mockRequest: TransferRequestItem = {
      id: "req_101",
      eventId: "evt_vip_dinner",
      originalUserId: "usr_alice",
      originalUserName: "Alice Smith",
      status: "pending",
      createdAtIso: "2026-08-21T10:00:00Z",
    };

    const selectedCandidate: WaitlistCandidate = {
      userId: "usr_alex",
      userName: "Alex Johnson",
      joinedWaitlistAtIso: "2026-08-21T09:00:00Z",
    };

    const grant = approveManualTicketGrant(mockRequest, selectedCandidate);

    expect(grant.updatedRequest.status).toBe("approved");
    expect(grant.updatedRequest.targetUserId).toBe("usr_alex");
    expect(grant.transferPayload.toUserId).toBe("usr_alex");
  });
});
