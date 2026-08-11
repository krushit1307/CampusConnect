import { describe, it, expect } from "vitest";
import {
  generateTicketSignature,
  verifyTicketSignature,
  createTransferEscrow,
  isTransferExpired,
  TRANSFER_EXPIRATION_MS,
} from "./ticketTransfer";

describe("Secure Ticket Transfer & Verification Suite (#2681)", () => {
  const ticketId = "tkt_1001";
  const originalOwnerId = "usr_alice";
  const newOwnerId = "usr_bob";
  const eventId = "evt_gala_2026";

  it("generates and verifies valid cryptographic ticket signatures", () => {
    const signature = generateTicketSignature(ticketId, originalOwnerId, eventId);
    const payload = {
      ticketId,
      ownerId: originalOwnerId,
      eventId,
      issuedAt: Date.now(),
      signature,
    };

    expect(verifyTicketSignature(payload, originalOwnerId)).toBe(true);
  });

  it("invalidates old QR code signature after ownership is transferred to new user", () => {
    // QR code generated under original owner
    const signature = generateTicketSignature(ticketId, originalOwnerId, eventId);
    const oldQrPayload = {
      ticketId,
      ownerId: originalOwnerId,
      eventId,
      issuedAt: Date.now(),
      signature,
    };

    // Ownership transferred to newOwnerId in database
    expect(verifyTicketSignature(oldQrPayload, newOwnerId)).toBe(false);
  });

  it("creates escrow record with 24-hour expiry window and evaluates expiration", () => {
    const startTime = 1000000000000;
    const escrow = createTransferEscrow(ticketId, originalOwnerId, "bob@university.edu", startTime);

    expect(escrow.status).toBe("PENDING");
    expect(escrow.expiresAt - escrow.createdAt).toBe(TRANSFER_EXPIRATION_MS);

    // Before expiration
    expect(isTransferExpired(escrow, startTime + 1000)).toBe(false);

    // After 24 hours
    expect(isTransferExpired(escrow, startTime + TRANSFER_EXPIRATION_MS + 1)).toBe(true);
  });
});
