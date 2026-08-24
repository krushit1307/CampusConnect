/**
 * Test suite: Room Booking No-Show Reclaim & Waitlist Cascade (#4390)
 * File: tests/services/roomNoShowReclaimService.test.ts
 *
 * Eligibility is a pure predicate over a supplied evaluation time, so every
 * case below pins that instant explicitly rather than leaning on the clock.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  RoomNoShowReclaimService,
  MIN_GRACE_MINUTES,
  MAX_GRACE_MINUTES,
  MIN_USABLE_REMAINING_MINUTES,
  OFFER_TTL_MINUTES,
  type RoomBooking,
} from "../../src/services/roomNoShowReclaimService";

const ROOM = "room-library-3b";
const HOLDER = "user-holder";

const SLOT_START = new Date("2026-05-12T14:00:00.000Z");
const MINUTE = 60_000;

function at(minutesAfterStart: number): Date {
  return new Date(SLOT_START.getTime() + minutesAfterStart * MINUTE);
}

function booking(overrides: Partial<RoomBooking> = {}): RoomBooking {
  return {
    bookingId: "BK-0001",
    roomId: ROOM,
    holderUserId: HOLDER,
    startsAt: SLOT_START,
    // A three-hour slot, so grace clamps to the maximum.
    endsAt: at(180),
    status: "BOOKED",
    ...overrides,
  };
}

describe("RoomNoShowReclaimService (#4390)", () => {
  let service: RoomNoShowReclaimService;

  beforeEach(() => {
    service = new RoomNoShowReclaimService();
  });

  describe("registration", () => {
    test("rejects a booking that ends before it starts", () => {
      expect(() => service.registerBooking(booking({ endsAt: SLOT_START }))).toThrow(
        /must end after it starts/i,
      );
    });

    test("rejects a booking with no holder", () => {
      expect(() => service.registerBooking(booking({ holderUserId: "" }))).toThrow(
        /requires a holder/i,
      );
    });
  });

  describe("grace scales with slot length", () => {
    test("a short slot gets the minimum, not a flat twenty minutes", () => {
      // 20% of 30 minutes is 6, which is above the floor.
      const short = booking({ endsAt: at(30) });
      expect(service.graceMinutesFor(short)).toBe(6);
    });

    test("a very short slot is floored", () => {
      // 20% of 15 minutes is 3, below the floor.
      const tiny = booking({ endsAt: at(15) });
      expect(service.graceMinutesFor(tiny)).toBe(MIN_GRACE_MINUTES);
    });

    test("a long slot is capped", () => {
      // 20% of 180 minutes is 36, above the ceiling.
      expect(service.graceMinutesFor(booking())).toBe(MAX_GRACE_MINUTES);
    });

    test("a mid-length slot scales proportionally", () => {
      // 20% of 60 minutes is 12, inside the clamp.
      expect(service.graceMinutesFor(booking({ endsAt: at(60) }))).toBe(12);
    });

    test("a thirty-minute slot never gives away two thirds of itself", () => {
      const short = booking({ endsAt: at(30) });
      expect(service.graceMinutesFor(short)).toBeLessThan(15);
    });

    test("the deadline is the start plus the grace", () => {
      expect(service.graceDeadlineFor(booking({ endsAt: at(60) }))).toEqual(at(12));
    });
  });

  describe("eligibility is pure over the evaluation time", () => {
    beforeEach(() => {
      service.registerBooking(booking());
    });

    test("the same instant always gives the same answer", () => {
      const first = service.evaluateReclaim("BK-0001", at(45));
      const second = service.evaluateReclaim("BK-0001", at(45));

      expect(first).toEqual(second);
    });

    test("is not eligible inside the grace window", () => {
      const result = service.evaluateReclaim("BK-0001", at(10));

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("NOT_YET_PAST_GRACE");
    });

    test("is not eligible exactly on the deadline", () => {
      const result = service.evaluateReclaim("BK-0001", at(MAX_GRACE_MINUTES));

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("NOT_YET_PAST_GRACE");
    });

    test("becomes eligible one minute past the deadline", () => {
      const result = service.evaluateReclaim("BK-0001", at(MAX_GRACE_MINUTES + 1));

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe("ELIGIBLE");
    });

    test("is not eligible once somebody has checked in", () => {
      service.checkIn("BK-0001", "QR_SCAN", at(5));
      const result = service.evaluateReclaim("BK-0001", at(45));

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("ALREADY_CHECKED_IN");
    });

    test("is not eligible for an already reclaimed booking", () => {
      service.reclaim("BK-0001", at(45));
      const result = service.evaluateReclaim("BK-0001", at(60));

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("NOT_AN_ACTIVE_BOOKING");
    });

    test("refuses to churn the last few minutes of a booking", () => {
      const result = service.evaluateReclaim("BK-0001", at(180 - 4));

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("TOO_LITTLE_TIME_REMAINING");
    });

    test("is eligible right at the usable-remaining boundary", () => {
      const result = service.evaluateReclaim("BK-0001", at(180 - MIN_USABLE_REMAINING_MINUTES));

      expect(result.eligible).toBe(true);
    });

    test("reports the remaining minutes it used to decide", () => {
      expect(service.evaluateReclaim("BK-0001", at(60)).remainingMinutes).toBe(120);
    });

    test("throws for an unknown booking", () => {
      expect(() => service.evaluateReclaim("BK-NOPE", at(45))).toThrow(/unknown booking/i);
    });
  });

  describe("check-in", () => {
    beforeEach(() => {
      service.registerBooking(booking());
    });

    test("records the method and marks the booking claimed", () => {
      service.checkIn("BK-0001", "DOOR_BADGE", at(3));

      expect(service.getCheckIn("BK-0001")?.method).toBe("DOOR_BADGE");
      expect(service.getBooking("BK-0001")?.status).toBe("CHECKED_IN");
    });

    test("rejects a check-in before the slot starts", () => {
      expect(() => service.checkIn("BK-0001", "QR_SCAN", at(-5))).toThrow(
        /cannot be claimed before it starts/i,
      );
    });

    test("rejects a check-in after the slot ended", () => {
      expect(() => service.checkIn("BK-0001", "QR_SCAN", at(200))).toThrow(/already ended/i);
    });

    test("rejects a check-in on a reclaimed booking", () => {
      service.reclaim("BK-0001", at(45));

      expect(() => service.checkIn("BK-0001", "QR_SCAN", at(50))).toThrow(/already reclaimed/i);
    });

    test("a check-in inside grace protects the booking from the sweep", () => {
      service.checkIn("BK-0001", "QR_SCAN", at(1));
      const outcome = service.reclaim("BK-0001", at(45));

      expect(outcome.reclaimed).toBe(false);
      expect(service.getBooking("BK-0001")?.status).toBe("CHECKED_IN");
    });
  });

  describe("waitlist", () => {
    test("orders by position, then by request time", () => {
      service.joinWaitlist({ roomId: ROOM, userId: "user-b", position: 2, requestedAt: at(0) });
      service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 1, requestedAt: at(5) });

      expect(service.getWaitlist(ROOM).map((entry) => entry.userId)).toEqual(["user-a", "user-b"]);
    });

    test("rejects a duplicate join", () => {
      service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 1, requestedAt: at(0) });

      expect(() =>
        service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 2, requestedAt: at(1) }),
      ).toThrow(/already on the waitlist/i);
    });
  });

  describe("reclaim and offer", () => {
    beforeEach(() => {
      service.registerBooking(booking());
      service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 1, requestedAt: at(0) });
      service.joinWaitlist({ roomId: ROOM, userId: "user-b", position: 2, requestedAt: at(0) });
    });

    test("reclaims an abandoned booking and offers it to the head of the queue", () => {
      const outcome = service.reclaim("BK-0001", at(45));

      expect(outcome.reclaimed).toBe(true);
      expect(outcome.offer?.offeredToUserId).toBe("user-a");
      expect(service.getBooking("BK-0001")?.status).toBe("RECLAIMED");
    });

    test("the offered window starts at the reclaim, not the original start", () => {
      const outcome = service.reclaim("BK-0001", at(45));

      // The first 45 minutes are gone; promising them would be a lie.
      expect(outcome.offer?.slotStartsAt).toEqual(at(45));
      expect(outcome.offer?.slotEndsAt).toEqual(at(180));
    });

    test("the offer carries a short expiry", () => {
      const outcome = service.reclaim("BK-0001", at(45));

      expect(outcome.offer?.expiresAt).toEqual(at(45 + OFFER_TTL_MINUTES));
    });

    test("an offer expiry never runs past the end of the slot", () => {
      // The usable-remaining floor (20m) exceeds the offer TTL (10m), so the
      // clamp in offerToNextCandidate is a guard rather than a live branch.
      // Assert the invariant it protects across the whole eligible range.
      for (const endsAtMinutes of [70, 90, 180]) {
        const id = `BK-TAIL-${endsAtMinutes}`;
        service.registerBooking(booking({ bookingId: id, endsAt: at(endsAtMinutes) }));

        const reclaimAt = endsAtMinutes - MIN_USABLE_REMAINING_MINUTES;
        const outcome = service.reclaim(id, at(reclaimAt));

        expect(outcome.offer).not.toBeNull();
        expect(outcome.offer!.expiresAt.getTime()).toBeLessThanOrEqual(
          outcome.offer!.slotEndsAt.getTime(),
        );
      }
    });

    test("returns a reason instead of throwing when not eligible", () => {
      const outcome = service.reclaim("BK-0001", at(5));

      expect(outcome.reclaimed).toBe(false);
      expect(outcome.reason).toBe("NOT_YET_PAST_GRACE");
      expect(outcome.offer).toBeNull();
    });

    test("never offers the slot back to the holder who abandoned it", () => {
      service.joinWaitlist({ roomId: ROOM, userId: HOLDER, position: 0, requestedAt: at(0) });
      const outcome = service.reclaim("BK-0001", at(45));

      expect(outcome.offer?.offeredToUserId).not.toBe(HOLDER);
    });

    test("returns the slot to general availability when nobody is waiting", () => {
      service.registerBooking(booking({ bookingId: "BK-QUIET", roomId: "room-empty" }));
      const outcome = service.reclaim("BK-QUIET", at(45));

      expect(outcome.reclaimed).toBe(true);
      expect(outcome.offer).toBeNull();
      expect(outcome.returnedToGeneralAvailability).toBe(true);
    });

    test("counts the no-show against the holder", () => {
      service.reclaim("BK-0001", at(45));
      expect(service.getNoShowCount(HOLDER)).toBe(1);
    });

    test("accumulates repeat no-shows", () => {
      service.registerBooking(
        booking({ bookingId: "BK-0002", startsAt: at(200), endsAt: at(380) }),
      );

      service.reclaim("BK-0001", at(45));
      service.reclaim("BK-0002", at(245));

      expect(service.getNoShowCount(HOLDER)).toBe(2);
    });

    test("leaves a student who turns up with a clean record", () => {
      service.checkIn("BK-0001", "QR_SCAN", at(2));
      service.reclaim("BK-0001", at(45));

      expect(service.getNoShowCount(HOLDER)).toBe(0);
    });
  });

  describe("offer cascade", () => {
    beforeEach(() => {
      service.registerBooking(booking());
      service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 1, requestedAt: at(0) });
      service.joinWaitlist({ roomId: ROOM, userId: "user-b", position: 2, requestedAt: at(0) });
      service.joinWaitlist({ roomId: ROOM, userId: "user-c", position: 3, requestedAt: at(0) });
    });

    test("a decline moves the offer down the queue", () => {
      const first = service.reclaim("BK-0001", at(45)).offer;
      const next = service.declineOffer(first!.offerId, at(48));

      expect(next?.offeredToUserId).toBe("user-b");
      expect(service.getOffer(first!.offerId)?.status).toBe("DECLINED");
    });

    test("nobody is offered the same slot twice", () => {
      const first = service.reclaim("BK-0001", at(45)).offer;
      const second = service.declineOffer(first!.offerId, at(48));
      const third = service.declineOffer(second!.offerId, at(52));

      const recipients = service.getOffersForBooking("BK-0001").map((o) => o.offeredToUserId);
      expect(new Set(recipients).size).toBe(recipients.length);
      expect(third?.offeredToUserId).toBe("user-c");
    });

    test("the slot returns to general availability once the queue is exhausted", () => {
      let offer = service.reclaim("BK-0001", at(45)).offer;
      offer = service.declineOffer(offer!.offerId, at(48));
      offer = service.declineOffer(offer!.offerId, at(52));
      const exhausted = service.declineOffer(offer!.offerId, at(56));

      expect(exhausted).toBeNull();
    });

    test("expiring an offer cascades rather than leaving the room empty", () => {
      const first = service.reclaim("BK-0001", at(45)).offer;
      const cascaded = service.expireStaleOffers(at(45 + OFFER_TTL_MINUTES + 1));

      expect(service.getOffer(first!.offerId)?.status).toBe("EXPIRED");
      expect(cascaded).toHaveLength(1);
      expect(cascaded[0].offeredToUserId).toBe("user-b");
    });

    test("a live offer is left alone by the expiry sweep", () => {
      service.reclaim("BK-0001", at(45));
      expect(service.expireStaleOffers(at(50))).toHaveLength(0);
    });

    test("declining past the deadline records it as expired, not declined", () => {
      const first = service.reclaim("BK-0001", at(45)).offer;
      service.declineOffer(first!.offerId, at(45 + OFFER_TTL_MINUTES + 5));

      expect(service.getOffer(first!.offerId)?.status).toBe("EXPIRED");
    });

    test("stops cascading when too little of the slot is left to be useful", () => {
      service.registerBooking(booking({ bookingId: "BK-TAIL", endsAt: at(70) }));
      const first = service.reclaim("BK-TAIL", at(45)).offer;

      // By 55 minutes in only 15 remain, under the usable minimum.
      const next = service.declineOffer(first!.offerId, at(55));
      expect(next).toBeNull();
    });

    test("rejects a decline on an already resolved offer", () => {
      const first = service.reclaim("BK-0001", at(45)).offer;
      service.declineOffer(first!.offerId, at(48));

      expect(() => service.declineOffer(first!.offerId, at(50))).toThrow(/already DECLINED/i);
    });

    test("throws for an unknown offer", () => {
      expect(() => service.declineOffer("OFFER-9999", at(50))).toThrow(/unknown reclaim offer/i);
    });
  });

  describe("accepting an offer", () => {
    beforeEach(() => {
      service.registerBooking(booking());
      service.joinWaitlist({ roomId: ROOM, userId: "user-a", position: 1, requestedAt: at(0) });
      service.joinWaitlist({ roomId: ROOM, userId: "user-b", position: 2, requestedAt: at(0) });
    });

    test("converts the offer into a booking for the remainder", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;
      const created = service.acceptOffer(offer!.offerId, at(48));

      expect(created.holderUserId).toBe("user-a");
      expect(created.startsAt).toEqual(at(45));
      expect(created.endsAt).toEqual(at(180));
      expect(created.status).toBe("BOOKED");
    });

    test("takes the accepting student off the waitlist", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;
      service.acceptOffer(offer!.offerId, at(48));

      expect(service.getWaitlist(ROOM).map((entry) => entry.userId)).not.toContain("user-a");
    });

    test("the new booking has its own grace window", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;
      const created = service.acceptOffer(offer!.offerId, at(48));

      const result = service.evaluateReclaim(created.bookingId, at(50));
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("NOT_YET_PAST_GRACE");
    });

    test("refuses an expired offer", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;

      expect(() => service.acceptOffer(offer!.offerId, at(45 + OFFER_TTL_MINUTES + 1))).toThrow(
        /expired/i,
      );
    });

    test("refuses an offer already declined", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;
      service.declineOffer(offer!.offerId, at(48));

      expect(() => service.acceptOffer(offer!.offerId, at(50))).toThrow(
        /can no longer be accepted/i,
      );
    });

    test("cannot be accepted twice", () => {
      const offer = service.reclaim("BK-0001", at(45)).offer;
      service.acceptOffer(offer!.offerId, at(48));

      expect(() => service.acceptOffer(offer!.offerId, at(49))).toThrow(
        /can no longer be accepted/i,
      );
    });
  });

  describe("room sweep", () => {
    test("reclaims only what is genuinely abandoned", () => {
      service.registerBooking(booking({ bookingId: "BK-GHOST" }));
      service.registerBooking(booking({ bookingId: "BK-PRESENT", holderUserId: "user-present" }));
      service.registerBooking(
        booking({ bookingId: "BK-FUTURE", startsAt: at(120), endsAt: at(300) }),
      );
      service.checkIn("BK-PRESENT", "QR_SCAN", at(4));

      const outcomes = service.sweepRoom(ROOM, at(45));
      const reclaimed = outcomes.filter((outcome) => outcome.reclaimed).map((o) => o.bookingId);

      expect(reclaimed).toEqual(["BK-GHOST"]);
    });

    test("returns a result for every booking, not just the reclaimed ones", () => {
      service.registerBooking(booking({ bookingId: "BK-A" }));
      service.registerBooking(booking({ bookingId: "BK-B", holderUserId: "user-two" }));
      service.checkIn("BK-B", "QR_SCAN", at(2));

      expect(service.sweepRoom(ROOM, at(45))).toHaveLength(2);
    });

    test("does not reach into another room", () => {
      service.registerBooking(booking({ bookingId: "BK-OTHER", roomId: "room-other" }));
      expect(service.sweepRoom(ROOM, at(45))).toHaveLength(0);
    });
  });
});
