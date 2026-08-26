/**
 * Test suite: Physical Key & Access Card Custody Chain (#4557)
 * File: tests/services/keyCustodyChainService.test.ts
 *
 * Custody is a fold over the event log, so the cases below build state by
 * issuing and transferring rather than by setting a holder, and every custody
 * question names the instant it is asked about.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  KeyCustodyChainService,
  type Credential,
  type Keyway,
} from "../../src/services/keyCustodyChainService";

const CLUB = "club-robotics";
const KEYWAY = "keyway-lab-block-c";
const LAB_KEY = "cred-key-lab-c";
const MEDIA_CARD = "cred-card-media-suite";

const ALICE = "user-alice";
const BEN = "user-ben";
const CHIDI = "user-chidi";

const TERM_START = new Date("2026-09-01T00:00:00.000Z");
const DAY = 86_400_000;

function day(offset: number): Date {
  return new Date(TERM_START.getTime() + offset * DAY);
}

function keyway(overrides: Partial<Keyway> = {}): Keyway {
  return {
    keywayId: KEYWAY,
    buildingId: "building-science",
    doors: [
      { doorId: "door-c101", label: "Lab C101", rekeyCostCents: 12_000 },
      { doorId: "door-c102", label: "Lab C102", rekeyCostCents: 12_000 },
      { doorId: "door-store", label: "Component store", rekeyCostCents: 9_000 },
    ],
    keyCutCostCents: 1_500,
    ...overrides,
  };
}

function physicalKey(overrides: Partial<Credential> = {}): Credential {
  return {
    credentialId: LAB_KEY,
    clubId: CLUB,
    type: "PHYSICAL_KEY",
    label: "Lab block C master",
    keywayId: KEYWAY,
    replacementCostCents: 0,
    depositCents: 5_000,
    ...overrides,
  };
}

function accessCard(overrides: Partial<Credential> = {}): Credential {
  return {
    credentialId: MEDIA_CARD,
    clubId: CLUB,
    type: "ACCESS_CARD",
    label: "Media suite card",
    keywayId: null,
    replacementCostCents: 2_000,
    depositCents: 2_000,
    ...overrides,
  };
}

describe("KeyCustodyChainService (#4557)", () => {
  let service: KeyCustodyChainService;

  beforeEach(() => {
    service = new KeyCustodyChainService();
    service.registerKeyway(keyway());
    service.registerCredential(physicalKey());
    service.registerCredential(accessCard());
  });

  describe("registration", () => {
    test("rejects a duplicate keyway", () => {
      expect(() => service.registerKeyway(keyway())).toThrow(/already registered/i);
    });

    test("rejects a keyway that opens nothing", () => {
      expect(() => service.registerKeyway(keyway({ keywayId: "keyway-empty", doors: [] }))).toThrow(
        /at least one door/i,
      );
    });

    test("rejects a duplicate credential", () => {
      expect(() => service.registerCredential(physicalKey())).toThrow(/already registered/i);
    });

    test("rejects a physical key with no keyway", () => {
      expect(() =>
        service.registerCredential(physicalKey({ credentialId: "cred-x", keywayId: null })),
      ).toThrow(/must name a keyway/i);
    });

    test("rejects a physical key on an unknown keyway", () => {
      expect(() =>
        service.registerCredential(
          physicalKey({ credentialId: "cred-x", keywayId: "keyway-none" }),
        ),
      ).toThrow(/Unknown keyway/i);
    });

    test("rejects an access card carrying a keyway", () => {
      expect(() =>
        service.registerCredential(accessCard({ credentialId: "cred-x", keywayId: KEYWAY })),
      ).toThrow(/cannot belong to a keyway/i);
    });

    test("an unknown credential throws", () => {
      expect(() => service.assess("cred-none", day(1))).toThrow(/Unknown credential/i);
    });

    test("a newly registered credential is in the store", () => {
      const state = service.holderAt(LAB_KEY, day(0));
      expect(state.holderUserId).toBeNull();
      expect(service.assess(LAB_KEY, day(0)).standing).toBe("IN_STORE");
    });
  });

  describe("issue", () => {
    test("issuing puts the credential in someone's hands", () => {
      expect(service.issue(LAB_KEY, ALICE, day(1)).outcome).toBe("ISSUED");
      expect(service.holderAt(LAB_KEY, day(1)).holderUserId).toBe(ALICE);
      expect(service.assess(LAB_KEY, day(1)).standing).toBe("HELD");
    });

    test("issuing something already out is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.issue(LAB_KEY, BEN, day(2)).outcome).toBe("REFUSED_NOT_IN_STORE");
      expect(service.holderAt(LAB_KEY, day(2)).holderUserId).toBe(ALICE);
    });

    test("issuing a revoked card is refused", () => {
      service.issue(MEDIA_CARD, ALICE, day(1));
      service.revoke(MEDIA_CARD, day(2), "Left the club");
      expect(service.issue(MEDIA_CARD, BEN, day(3)).outcome).toBe("REFUSED_RETIRED");
    });

    test("a returned credential can be issued again", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.returnToStore(LAB_KEY, ALICE, day(10));
      expect(service.issue(LAB_KEY, BEN, day(11)).outcome).toBe("ISSUED");
      expect(service.holderAt(LAB_KEY, day(11)).holderUserId).toBe(BEN);
    });

    test("custody before the issue is empty", () => {
      service.issue(LAB_KEY, ALICE, day(5));
      expect(service.holderAt(LAB_KEY, day(4)).holderUserId).toBeNull();
    });
  });

  describe("the chain cannot be broken", () => {
    test("a transfer from someone who is not holding it is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      // Ben never had it. This is the break the module exists to catch.
      const result = service.initiateTransfer(LAB_KEY, BEN, CHIDI, day(5));
      expect(result.outcome).toBe("REFUSED_BROKEN_CHAIN");
      expect(service.holderAt(LAB_KEY, day(5)).holderUserId).toBe(ALICE);
    });

    test("a refused transfer writes nothing to the log", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      const before = service.custodyLog(LAB_KEY).length;
      service.initiateTransfer(LAB_KEY, BEN, CHIDI, day(5));
      expect(service.custodyLog(LAB_KEY)).toHaveLength(before);
    });

    test("a transfer of something in the store is refused", () => {
      expect(service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5)).outcome).toBe(
        "REFUSED_NOT_HELD",
      );
    });

    test("a transfer to oneself is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.initiateTransfer(LAB_KEY, ALICE, ALICE, day(5)).outcome).toBe(
        "REFUSED_SELF_TRANSFER",
      );
    });

    test("a second transfer while one is pending is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      expect(service.initiateTransfer(LAB_KEY, ALICE, CHIDI, day(6)).outcome).toBe(
        "REFUSED_TRANSFER_PENDING",
      );
    });

    test("a transfer on a revoked card is refused", () => {
      service.issue(MEDIA_CARD, ALICE, day(1));
      service.revoke(MEDIA_CARD, day(2), "Left the club");
      expect(service.initiateTransfer(MEDIA_CARD, ALICE, BEN, day(3)).outcome).toBe(
        "REFUSED_RETIRED",
      );
    });
  });

  describe("a transfer is two-sided", () => {
    test("custody stays with the sender until it is acknowledged", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));

      const state = service.holderAt(LAB_KEY, day(6));
      expect(state.holderUserId).toBe(ALICE);
      expect(state.pendingTransferToUserId).toBe(BEN);
      expect(service.assess(LAB_KEY, day(6)).standing).toBe("IN_TRANSFER");
    });

    test("acknowledgement moves custody", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      expect(service.acknowledgeTransfer(LAB_KEY, BEN, day(6)).outcome).toBe("ACKNOWLEDGED");

      const state = service.holderAt(LAB_KEY, day(6));
      expect(state.holderUserId).toBe(BEN);
      expect(state.pendingTransferToUserId).toBeNull();
    });

    test("declining leaves custody with the sender", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      expect(service.declineTransfer(LAB_KEY, BEN, day(6)).outcome).toBe("DECLINED");

      const state = service.holderAt(LAB_KEY, day(6));
      expect(state.holderUserId).toBe(ALICE);
      expect(state.pendingTransferToUserId).toBeNull();
    });

    test("somebody other than the recipient cannot acknowledge", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      expect(service.acknowledgeTransfer(LAB_KEY, CHIDI, day(6)).outcome).toBe(
        "REFUSED_NOT_THE_RECIPIENT",
      );
      expect(service.holderAt(LAB_KEY, day(6)).holderUserId).toBe(ALICE);
    });

    test("acknowledging with nothing pending is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.acknowledgeTransfer(LAB_KEY, BEN, day(5)).outcome).toBe(
        "REFUSED_NO_PENDING_TRANSFER",
      );
    });

    test("after a decline the sender can transfer to somebody else", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      service.declineTransfer(LAB_KEY, BEN, day(6));
      expect(service.initiateTransfer(LAB_KEY, ALICE, CHIDI, day(7)).outcome).toBe(
        "TRANSFER_INITIATED",
      );
    });

    test("a chain of handovers folds to the last acknowledged holder", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      service.acknowledgeTransfer(LAB_KEY, BEN, day(6));
      service.initiateTransfer(LAB_KEY, BEN, CHIDI, day(20));
      service.acknowledgeTransfer(LAB_KEY, CHIDI, day(21));

      expect(service.holderAt(LAB_KEY, day(21)).holderUserId).toBe(CHIDI);
      // And the log still answers who had it in between.
      expect(service.holderAt(LAB_KEY, day(10)).holderUserId).toBe(BEN);
      expect(service.holderAt(LAB_KEY, day(3)).holderUserId).toBe(ALICE);
    });
  });

  describe("return", () => {
    test("the holder can return it", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.returnToStore(LAB_KEY, ALICE, day(10)).outcome).toBe("RETURNED");
      expect(service.holderAt(LAB_KEY, day(10)).holderUserId).toBeNull();
    });

    test("somebody else cannot return it", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.returnToStore(LAB_KEY, BEN, day(10)).outcome).toBe("REFUSED_NOT_THE_HOLDER");
    });

    test("returning while a transfer is pending is refused", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      expect(service.returnToStore(LAB_KEY, ALICE, day(6)).outcome).toBe(
        "REFUSED_TRANSFER_PENDING",
      );
    });

    test("returning something already in the store is refused", () => {
      expect(service.returnToStore(LAB_KEY, ALICE, day(10)).outcome).toBe("REFUSED_NOT_HELD");
    });
  });

  describe("keys and cards are not the same kind of thing", () => {
    test("an access card can be switched off", () => {
      service.issue(MEDIA_CARD, ALICE, day(1));
      expect(service.revoke(MEDIA_CARD, day(30), "Graduated").outcome).toBe("REVOKED");

      const assessment = service.assess(MEDIA_CARD, day(31));
      expect(assessment.standing).toBe("RETIRED");
      expect(assessment.holderUserId).toBeNull();
    });

    test("a physical key cannot be", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      const result = service.revoke(LAB_KEY, day(30), "Graduated");

      // There is no software action that stops brass opening a door, and
      // recording one would leave an open door looking closed.
      expect(result.outcome).toBe("REFUSED_PHYSICAL_KEY");
      expect(service.holderAt(LAB_KEY, day(31)).holderUserId).toBe(ALICE);
    });

    test("revoking a card in the store is refused", () => {
      expect(service.revoke(MEDIA_CARD, day(5), "unused").outcome).toBe("REFUSED_NOT_HELD");
    });

    test("revoking twice is refused", () => {
      service.issue(MEDIA_CARD, ALICE, day(1));
      service.revoke(MEDIA_CARD, day(5), "Graduated");
      expect(service.revoke(MEDIA_CARD, day(6), "again").outcome).toBe("REFUSED_ALREADY_RETIRED");
    });

    test("a card's exposure is its replacement cost", () => {
      const exposure = service.rekeyExposure(MEDIA_CARD, day(10));
      expect(exposure.totalCents).toBe(2_000);
      expect(exposure.replacementCents).toBe(2_000);
      expect(exposure.doorsAffected).toBe(0);
    });

    test("a key's exposure is every lock on its keyway plus every other key", () => {
      service.registerCredential(physicalKey({ credentialId: "cred-key-2", depositCents: 5_000 }));
      service.registerCredential(physicalKey({ credentialId: "cred-key-3", depositCents: 5_000 }));

      const exposure = service.rekeyExposure(LAB_KEY, day(10));
      expect(exposure.doorsAffected).toBe(3);
      expect(exposure.doorRekeyCents).toBe(33_000);
      expect(exposure.keysToRecut).toBe(2);
      expect(exposure.keyRecutCents).toBe(3_000);
      expect(exposure.totalCents).toBe(36_000);
    });

    test("the lost key is not counted among the keys to recut", () => {
      const exposure = service.rekeyExposure(LAB_KEY, day(10));
      expect(exposure.keysToRecut).toBe(0);
      expect(exposure.totalCents).toBe(33_000);
    });

    test("keys on another keyway are not affected", () => {
      service.registerKeyway(
        keyway({
          keywayId: "keyway-studio",
          doors: [{ doorId: "door-studio", label: "Studio", rekeyCostCents: 8_000 }],
        }),
      );
      service.registerCredential(
        physicalKey({ credentialId: "cred-key-studio", keywayId: "keyway-studio" }),
      );
      expect(service.rekeyExposure(LAB_KEY, day(10)).keysToRecut).toBe(0);
    });

    test("a key is an order of magnitude dearer than a card", () => {
      expect(service.rekeyExposure(LAB_KEY, day(10)).totalCents).toBeGreaterThan(
        service.rekeyExposure(MEDIA_CARD, day(10)).totalCents * 10,
      );
    });
  });

  describe("return demands and delinquency", () => {
    test("a demand inside its deadline is not delinquency", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");

      const assessment = service.assess(LAB_KEY, day(110));
      expect(assessment.delinquent).toBe(false);
      expect(assessment.standing).toBe("HELD");
      expect(assessment.returnDemand?.reason).toBe("Graduating");
    });

    test("past the deadline and still held is delinquent", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");

      const assessment = service.assess(LAB_KEY, day(115));
      expect(assessment.delinquent).toBe(true);
      expect(assessment.standing).toBe("DELINQUENT");
      expect(assessment.exposureCents).toBe(33_000);
    });

    test("the deadline itself is not yet late", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");
      expect(service.assess(LAB_KEY, day(114)).delinquent).toBe(false);
    });

    test("returning it clears the demand", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");
      service.returnToStore(LAB_KEY, ALICE, day(110));

      const assessment = service.assess(LAB_KEY, day(200));
      expect(assessment.delinquent).toBe(false);
      expect(assessment.returnDemand).toBeNull();
      expect(assessment.standing).toBe("IN_STORE");
    });

    test("a demand with no time to comply is refused", () => {
      expect(() => service.raiseReturnDemand(LAB_KEY, day(100), day(100), "now")).toThrow(
        /time to comply/i,
      );
    });

    test("exposure is quoted before delinquency, not only after", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.assess(LAB_KEY, day(2)).exposureCents).toBe(33_000);
    });
  });

  describe("deposits", () => {
    test("a credential returned on time is refunded in full", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");
      service.returnToStore(LAB_KEY, ALICE, day(110));

      const settlement = service.settleDeposit(LAB_KEY, day(120));
      expect(settlement.refundedCents).toBe(5_000);
      expect(settlement.forfeitedCents).toBe(0);
    });

    test("a delinquent key forfeits the whole deposit and still leaves a shortfall", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");

      const settlement = service.settleDeposit(LAB_KEY, day(115));
      expect(settlement.forfeitedCents).toBe(5_000);
      expect(settlement.refundedCents).toBe(0);
      // The rest of the rekey is a real cost the club has to find.
      expect(settlement.unrecoveredShortfallCents).toBe(28_000);
    });

    test("a deposit larger than the exposure is only partly forfeited", () => {
      service.registerCredential(
        accessCard({
          credentialId: "cred-card-generous",
          replacementCostCents: 2_000,
          depositCents: 9_000,
        }),
      );
      service.issue("cred-card-generous", ALICE, day(1));
      service.raiseReturnDemand("cred-card-generous", day(100), day(114), "Graduating");

      const settlement = service.settleDeposit("cred-card-generous", day(115));
      // A deposit bigger than the cost of putting things right is not a
      // windfall; keeping the difference would make it a fine.
      expect(settlement.forfeitedCents).toBe(2_000);
      expect(settlement.refundedCents).toBe(7_000);
      expect(settlement.unrecoveredShortfallCents).toBe(0);
    });

    test("a deposit exactly matching the exposure leaves nothing either way", () => {
      service.registerCredential(
        accessCard({
          credentialId: "cred-card-exact",
          replacementCostCents: 2_000,
          depositCents: 2_000,
        }),
      );
      service.issue("cred-card-exact", ALICE, day(1));
      service.raiseReturnDemand("cred-card-exact", day(100), day(114), "Graduating");

      const settlement = service.settleDeposit("cred-card-exact", day(115));
      expect(settlement.forfeitedCents).toBe(2_000);
      expect(settlement.refundedCents).toBe(0);
      expect(settlement.unrecoveredShortfallCents).toBe(0);
    });

    test("a credential with no demand against it is refunded", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.settleDeposit(LAB_KEY, day(200)).refundedCents).toBe(5_000);
    });
  });

  describe("what a club is carrying", () => {
    test("delinquent credentials come first and are totalled", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.issue(MEDIA_CARD, BEN, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");
      service.raiseReturnDemand(MEDIA_CARD, day(100), day(114), "Graduating");

      const { assessments, delinquentExposureCents } = service.clubExposure(CLUB, day(120));
      expect(assessments[0].credentialId).toBe(LAB_KEY);
      expect(delinquentExposureCents).toBe(35_000);
    });

    test("a key outranks a card in the list even when both are late", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.issue(MEDIA_CARD, BEN, day(1));
      service.raiseReturnDemand(LAB_KEY, day(100), day(114), "Graduating");
      service.raiseReturnDemand(MEDIA_CARD, day(100), day(114), "Graduating");

      const { assessments } = service.clubExposure(CLUB, day(120));
      expect(assessments.map((entry) => entry.credentialId)).toEqual([LAB_KEY, MEDIA_CARD]);
    });

    test("the list does not reach into another club", () => {
      service.registerCredential(
        accessCard({ credentialId: "cred-card-other", clubId: "club-drama" }),
      );
      const { assessments } = service.clubExposure(CLUB, day(10));
      expect(assessments.map((entry) => entry.credentialId)).not.toContain("cred-card-other");
    });

    test("nothing delinquent totals to nothing", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      expect(service.clubExposure(CLUB, day(10)).delinquentExposureCents).toBe(0);
    });
  });

  describe("the log", () => {
    test("every custody change is recorded in order", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.initiateTransfer(LAB_KEY, ALICE, BEN, day(5));
      service.acknowledgeTransfer(LAB_KEY, BEN, day(6));
      service.returnToStore(LAB_KEY, BEN, day(10));

      const log = service.custodyLog(LAB_KEY);
      expect(log.map((event) => event.type)).toEqual([
        "ISSUED",
        "TRANSFER_INITIATED",
        "TRANSFER_ACKNOWLEDGED",
        "RETURNED",
      ]);
      const sequences = log.map((event) => event.sequence);
      expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    });

    test("one credential's log does not include another's", () => {
      service.issue(LAB_KEY, ALICE, day(1));
      service.issue(MEDIA_CARD, BEN, day(1));
      expect(service.custodyLog(LAB_KEY)).toHaveLength(1);
      expect(service.custodyLog(MEDIA_CARD)).toHaveLength(1);
    });
  });
});
