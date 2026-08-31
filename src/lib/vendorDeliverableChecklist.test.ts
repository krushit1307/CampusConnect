import { describe, it, expect } from "vitest";
import {
  evaluateDeliverableEscrowRelease,
  signoffDeliverableItem,
  DeliverableItem,
} from "./vendorDeliverableChecklist";

describe("Build Interactive Vendor Bidding Deliverable Checklist Suite (#4523)", () => {
  const sampleDeliverables: DeliverableItem[] = [
    {
      id: "del_1",
      contractId: "ctr_dj_100",
      title: "Arrived at 5 PM",
      vendorChecked: false,
      organizerCountersigned: false,
    },
    {
      id: "del_2",
      contractId: "ctr_dj_100",
      title: "Bring 2 speakers",
      vendorChecked: false,
      organizerCountersigned: false,
    },
  ];

  it("blocks escrow release when deliverables are incomplete or lack mutual countersignatures", () => {
    const initialEval = evaluateDeliverableEscrowRelease(sampleDeliverables);
    expect(initialEval.isEscrowUnlocked).toBe(false);
    expect(initialEval.completionPercentage).toBe(0);

    // Vendor checks item 1, but organizer hasn't countersigned yet
    const vendorSigned1 = signoffDeliverableItem(sampleDeliverables[0], "vendor");
    const partialEval = evaluateDeliverableEscrowRelease([vendorSigned1, sampleDeliverables[1]]);

    expect(partialEval.isEscrowUnlocked).toBe(false);
    expect(partialEval.completedDeliverables).toBe(0); // Needs both signatures
  });

  it("unlocks escrow release only when 100% of deliverables are mutually checked and countersigned", () => {
    // Both signed item 1
    let item1 = signoffDeliverableItem(sampleDeliverables[0], "vendor");
    item1 = signoffDeliverableItem(item1, "organizer");

    // Both signed item 2
    let item2 = signoffDeliverableItem(sampleDeliverables[1], "vendor");
    item2 = signoffDeliverableItem(item2, "organizer");

    const fullEval = evaluateDeliverableEscrowRelease([item1, item2]);

    expect(fullEval.isEscrowUnlocked).toBe(true);
    expect(fullEval.completionPercentage).toBe(100);
    expect(fullEval.statusMessage).toContain(
      "100% of deliverables mutually verified! Escrow payment release unlocked.",
    );
  });
});
