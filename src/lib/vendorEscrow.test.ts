import { describe, it, expect } from "vitest";
import {
  resolveEscrowStage,
  formatEscrowAmount,
  buildEscrowAssuranceMessage,
  mapVendorEscrowTimeline,
  applyCryptographicTimestamp,
  type VendorEscrowContract,
} from "./vendorEscrow";

const djContract: VendorEscrowContract = {
  id: "vc-dj-1",
  vendor_name: "DJ",
  amount: 500,
  created_at: "2026-08-01T12:00:00.000Z",
  escrow_locked_at: "2026-08-01T12:05:00.000Z",
  released_at: null,
};

describe("Vendor Bidding Escrow Tracker (#4423)", () => {
  it("maps locked funds to the platform escrow stage", () => {
    expect(resolveEscrowStage(djContract)).toBe("escrow");
  });

  it("builds the Stripe escrow assurance message", () => {
    expect(buildEscrowAssuranceMessage(djContract)).toBe(
      "Your $500 is currently locked safely in the Stripe Escrow vault. The DJ cannot access it until you scan their QR code on the day of the event.",
    );
  });

  it("renders a 3-stage timeline with cryptographic timestamps on reached steps", async () => {
    const steps = await mapVendorEscrowTimeline(djContract);
    expect(steps.map((s) => s.label)).toEqual([
      "Funds in Club Ledger",
      "Funds Locked in Platform Escrow",
      "Funds Released to Vendor",
    ]);
    expect(steps[0].reached).toBe(true);
    expect(steps[1].reached).toBe(true);
    expect(steps[1].current).toBe(true);
    expect(steps[2].reached).toBe(false);
    expect(steps[1].cryptographicTimestamp).toBe(
      await applyCryptographicTimestamp("vc-dj-1", "escrow", "2026-08-01T12:05:00.000Z"),
    );
  });

  it("formats whole-dollar amounts without cents", () => {
    expect(formatEscrowAmount(500)).toBe("$500");
  });
});
