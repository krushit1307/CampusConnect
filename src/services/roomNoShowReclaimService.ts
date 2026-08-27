/**
 * Module: Room Booking No-Show Reclaim & Waitlist Cascade
 * File: src/services/roomNoShowReclaimService.ts
 * Scope: Opens a check-in window on every room booking, reclaims a booking
 *        nobody claimed, and cascades the freed slot down the waitlist on a
 *        short expiring hold so it cannot be sat on a second time (#4390).
 *
 * During exam weeks every slot is gone within minutes of opening, yet a third
 * of those rooms sit dark. A booking is currently treated as permanent from the
 * moment it is made, so nothing checks whether anyone turned up and nothing
 * hands the room back. The waitlist never fires because, as far as the system
 * is concerned, nothing was ever released.
 *
 * Every predicate below takes an explicit evaluation time. Nothing reads the
 * wall clock, which is what makes "was this booking abandoned at 14:05?" a
 * question with a reproducible answer.
 */

export type BookingStatus = "BOOKED" | "CHECKED_IN" | "RECLAIMED" | "CANCELLED" | "COMPLETED";

export type CheckInMethod = "QR_SCAN" | "DOOR_BADGE" | "MANUAL_STAFF";

export type OfferStatus = "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED";

/** Grace is this share of the slot length... */
export const GRACE_FRACTION_OF_SLOT = 0.2;

/** ...clamped into a range, so neither extreme becomes absurd. */
export const MIN_GRACE_MINUTES = 5;
export const MAX_GRACE_MINUTES = 20;

/** Reclaiming less than this much remaining time helps nobody. */
export const MIN_USABLE_REMAINING_MINUTES = 20;

/** How long a waitlist candidate has to take an offered slot. */
export const OFFER_TTL_MINUTES = 10;

const MS_PER_MINUTE = 60_000;

export interface RoomBooking {
  bookingId: string;
  roomId: string;
  holderUserId: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
}

export interface CheckIn {
  bookingId: string;
  method: CheckInMethod;
  checkedInAt: Date;
}

export interface WaitlistEntry {
  roomId: string;
  userId: string;
  /** Lower is earlier in the queue. */
  position: number;
  requestedAt: Date;
}

export interface ReclaimOffer {
  offerId: string;
  bookingId: string;
  roomId: string;
  offeredToUserId: string;
  offeredAt: Date;
  expiresAt: Date;
  /** Slot window the offer actually confers, which may be shorter than the original. */
  slotStartsAt: Date;
  slotEndsAt: Date;
  status: OfferStatus;
}

export interface ReclaimEligibility {
  eligible: boolean;
  reason:
    | "ELIGIBLE"
    | "NOT_YET_PAST_GRACE"
    | "ALREADY_CHECKED_IN"
    | "NOT_AN_ACTIVE_BOOKING"
    | "TOO_LITTLE_TIME_REMAINING";
  graceDeadline: Date;
  remainingMinutes: number;
}

interface ReclaimOutcome {
  bookingId: string;
  reclaimed: boolean;
  offer: ReclaimOffer | null;
  /** True when the waitlist was empty or exhausted and the slot is open to all. */
  returnedToGeneralAvailability: boolean;
  reason: ReclaimEligibility["reason"];
}

export class RoomNoShowReclaimService {
  private readonly bookings: Map<string, RoomBooking>;
  private readonly checkIns: Map<string, CheckIn>;
  private readonly waitlists: Map<string, WaitlistEntry[]>;
  private readonly offers: Map<string, ReclaimOffer>;
  private readonly noShowCounts: Map<string, number>;
  private offerSequence: number;

  constructor() {
    this.bookings = new Map();
    this.checkIns = new Map();
    this.waitlists = new Map();
    this.offers = new Map();
    this.noShowCounts = new Map();
    this.offerSequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Bookings and check-in
  // ---------------------------------------------------------------------------

  public registerBooking(booking: RoomBooking): void {
    if (booking.endsAt.getTime() <= booking.startsAt.getTime()) {
      throw new Error(`Booking ${booking.bookingId} must end after it starts.`);
    }
    if (!booking.holderUserId) {
      throw new Error(`Booking ${booking.bookingId} requires a holder.`);
    }
    this.bookings.set(booking.bookingId, { ...booking });
  }

  public getBooking(bookingId: string): RoomBooking | undefined {
    const booking = this.bookings.get(bookingId);
    return booking ? { ...booking } : undefined;
  }

  public checkIn(bookingId: string, method: CheckInMethod, checkedInAt: Date): void {
    const booking = this.requireBooking(bookingId);

    if (booking.status === "RECLAIMED") {
      throw new Error(
        `Booking ${bookingId} was already reclaimed. Ask for the slot back through the waitlist.`,
      );
    }
    if (booking.status === "CANCELLED") {
      throw new Error(`Booking ${bookingId} was cancelled.`);
    }
    if (checkedInAt.getTime() < booking.startsAt.getTime()) {
      throw new Error(`Booking ${bookingId} cannot be claimed before it starts.`);
    }
    if (checkedInAt.getTime() >= booking.endsAt.getTime()) {
      throw new Error(`Booking ${bookingId} had already ended.`);
    }

    this.checkIns.set(bookingId, { bookingId, method, checkedInAt });
    this.bookings.set(bookingId, { ...booking, status: "CHECKED_IN" });
  }

  public getCheckIn(bookingId: string): CheckIn | undefined {
    const checkIn = this.checkIns.get(bookingId);
    return checkIn ? { ...checkIn } : undefined;
  }

  // ---------------------------------------------------------------------------
  // Grace
  // ---------------------------------------------------------------------------

  /**
   * Grace scales with the slot rather than being a fixed constant.
   *
   * Twenty minutes of grace on a thirty-minute slot gives away two thirds of
   * the booking to somebody who never showed; five minutes on a three-hour
   * booking punishes someone stuck behind a late lecture. A fifth of the slot,
   * clamped, is a defensible middle.
   */
  public graceMinutesFor(booking: RoomBooking): number {
    const slotMinutes = (booking.endsAt.getTime() - booking.startsAt.getTime()) / MS_PER_MINUTE;
    const scaled = slotMinutes * GRACE_FRACTION_OF_SLOT;

    return Math.min(MAX_GRACE_MINUTES, Math.max(MIN_GRACE_MINUTES, Math.round(scaled)));
  }

  public graceDeadlineFor(booking: RoomBooking): Date {
    return new Date(booking.startsAt.getTime() + this.graceMinutesFor(booking) * MS_PER_MINUTE);
  }

  // ---------------------------------------------------------------------------
  // Eligibility
  // ---------------------------------------------------------------------------

  /**
   * A pure predicate over the supplied evaluation time. Nothing here reads the
   * wall clock, so the same booking and the same instant always give the same
   * answer, in a test or in a replay of last Tuesday.
   */
  public evaluateReclaim(bookingId: string, evaluatedAt: Date): ReclaimEligibility {
    const booking = this.requireBooking(bookingId);
    const graceDeadline = this.graceDeadlineFor(booking);
    const remainingMinutes = Math.max(
      0,
      (booking.endsAt.getTime() - evaluatedAt.getTime()) / MS_PER_MINUTE,
    );

    const base = { graceDeadline, remainingMinutes };

    if (booking.status !== "BOOKED") {
      return {
        ...base,
        eligible: false,
        reason: booking.status === "CHECKED_IN" ? "ALREADY_CHECKED_IN" : "NOT_AN_ACTIVE_BOOKING",
      };
    }
    if (this.checkIns.has(bookingId)) {
      return { ...base, eligible: false, reason: "ALREADY_CHECKED_IN" };
    }
    if (evaluatedAt.getTime() <= graceDeadline.getTime()) {
      return { ...base, eligible: false, reason: "NOT_YET_PAST_GRACE" };
    }
    // Reclaiming the last four minutes of a booking helps nobody and just
    // churns notifications at the waitlist.
    if (remainingMinutes < MIN_USABLE_REMAINING_MINUTES) {
      return { ...base, eligible: false, reason: "TOO_LITTLE_TIME_REMAINING" };
    }

    return { ...base, eligible: true, reason: "ELIGIBLE" };
  }

  // ---------------------------------------------------------------------------
  // Waitlist
  // ---------------------------------------------------------------------------

  public joinWaitlist(entry: WaitlistEntry): void {
    const queue = this.waitlists.get(entry.roomId) ?? [];

    if (queue.some((existing) => existing.userId === entry.userId)) {
      throw new Error(`${entry.userId} is already on the waitlist for ${entry.roomId}.`);
    }

    queue.push({ ...entry });
    queue.sort((a, b) => {
      const byPosition = a.position - b.position;
      return byPosition !== 0 ? byPosition : a.requestedAt.getTime() - b.requestedAt.getTime();
    });
    this.waitlists.set(entry.roomId, queue);
  }

  public getWaitlist(roomId: string): WaitlistEntry[] {
    return [...(this.waitlists.get(roomId) ?? [])].map((entry) => ({ ...entry }));
  }

  // ---------------------------------------------------------------------------
  // Reclaim
  // ---------------------------------------------------------------------------

  /**
   * Reclaims an abandoned booking and offers the freed slot to the head of the
   * waitlist. Returns what happened rather than throwing, because a caller
   * sweeping every booking in a building wants a result per booking, not an
   * exception that aborts the sweep.
   */
  public reclaim(bookingId: string, evaluatedAt: Date): ReclaimOutcome {
    const eligibility = this.evaluateReclaim(bookingId, evaluatedAt);

    if (!eligibility.eligible) {
      return {
        bookingId,
        reclaimed: false,
        offer: null,
        returnedToGeneralAvailability: false,
        reason: eligibility.reason,
      };
    }

    const booking = this.requireBooking(bookingId);
    this.bookings.set(bookingId, { ...booking, status: "RECLAIMED" });
    this.noShowCounts.set(
      booking.holderUserId,
      (this.noShowCounts.get(booking.holderUserId) ?? 0) + 1,
    );

    const offer = this.offerToNextCandidate(booking, evaluatedAt, new Set());

    return {
      bookingId,
      reclaimed: true,
      offer,
      returnedToGeneralAvailability: offer === null,
      reason: "ELIGIBLE",
    };
  }

  /** Sweeps a room, reclaiming everything eligible at the given instant. */
  public sweepRoom(roomId: string, evaluatedAt: Date): ReclaimOutcome[] {
    return Array.from(this.bookings.values())
      .filter((booking) => booking.roomId === roomId)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((booking) => this.reclaim(booking.bookingId, evaluatedAt));
  }

  // ---------------------------------------------------------------------------
  // Offers
  // ---------------------------------------------------------------------------

  public acceptOffer(offerId: string, acceptedAt: Date): RoomBooking {
    const offer = this.requireOffer(offerId);

    if (offer.status !== "OFFERED") {
      throw new Error(`Offer ${offerId} is ${offer.status} and can no longer be accepted.`);
    }
    if (acceptedAt.getTime() > offer.expiresAt.getTime()) {
      throw new Error(`Offer ${offerId} expired at ${offer.expiresAt.toISOString()}.`);
    }

    this.offers.set(offerId, { ...offer, status: "ACCEPTED" });
    this.removeFromWaitlist(offer.roomId, offer.offeredToUserId);

    const booking: RoomBooking = {
      bookingId: `${offer.bookingId}-R${this.offerSequence}`,
      roomId: offer.roomId,
      holderUserId: offer.offeredToUserId,
      startsAt: offer.slotStartsAt,
      endsAt: offer.slotEndsAt,
      status: "BOOKED",
    };

    this.bookings.set(booking.bookingId, booking);
    return { ...booking };
  }

  /**
   * Declines an offer and cascades to the next candidate. An expired offer is
   * handled the same way, since a candidate who never answered and one who said
   * no leave the room equally empty.
   */
  public declineOffer(offerId: string, declinedAt: Date): ReclaimOffer | null {
    const offer = this.requireOffer(offerId);

    if (offer.status !== "OFFERED") {
      throw new Error(`Offer ${offerId} is already ${offer.status}.`);
    }

    const expired = declinedAt.getTime() > offer.expiresAt.getTime();
    this.offers.set(offerId, { ...offer, status: expired ? "EXPIRED" : "DECLINED" });
    this.removeFromWaitlist(offer.roomId, offer.offeredToUserId);

    const booking = this.bookings.get(offer.bookingId);
    if (!booking) {
      return null;
    }

    return this.offerToNextCandidate(
      booking,
      declinedAt,
      this.usersAlreadyOffered(offer.bookingId),
    );
  }

  /**
   * Expires anything past its deadline and cascades each one onward. This is
   * the path a scheduled sweep takes; a silent expiry with no cascade would
   * leave the room empty for exactly the reason the feature exists to fix.
   */
  public expireStaleOffers(evaluatedAt: Date): ReclaimOffer[] {
    const cascaded: ReclaimOffer[] = [];

    const stale = Array.from(this.offers.values())
      .filter(
        (offer) => offer.status === "OFFERED" && offer.expiresAt.getTime() < evaluatedAt.getTime(),
      )
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

    for (const offer of stale) {
      this.offers.set(offer.offerId, { ...offer, status: "EXPIRED" });
      this.removeFromWaitlist(offer.roomId, offer.offeredToUserId);

      const booking = this.bookings.get(offer.bookingId);
      if (!booking) {
        continue;
      }

      const next = this.offerToNextCandidate(
        booking,
        evaluatedAt,
        this.usersAlreadyOffered(offer.bookingId),
      );
      if (next) {
        cascaded.push(next);
      }
    }

    return cascaded;
  }

  public getOffer(offerId: string): ReclaimOffer | undefined {
    const offer = this.offers.get(offerId);
    return offer ? { ...offer } : undefined;
  }

  public getOffersForBooking(bookingId: string): ReclaimOffer[] {
    return Array.from(this.offers.values())
      .filter((offer) => offer.bookingId === bookingId)
      .sort((a, b) => a.offeredAt.getTime() - b.offeredAt.getTime())
      .map((offer) => ({ ...offer }));
  }

  // ---------------------------------------------------------------------------
  // No-show history
  // ---------------------------------------------------------------------------

  /**
   * Kept so repeat offenders can later be rate-limited. Deliberately just a
   * count here: what a club or the timetabling office does with it is a policy
   * decision, and baking a penalty in at this layer would prejudge it.
   */
  public getNoShowCount(userId: string): number {
    return this.noShowCounts.get(userId) ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Offers the remainder of a freed slot to the first waitlist candidate who
   * has not already been asked.
   *
   * The offered window starts at the moment of reclaim, not at the original
   * booking start: the first twenty minutes are gone, and promising them would
   * be a lie. If that leaves too little to be useful, or the queue is
   * exhausted, the slot simply returns to general availability.
   */
  private offerToNextCandidate(
    booking: RoomBooking,
    from: Date,
    alreadyOffered: Set<string>,
  ): ReclaimOffer | null {
    const remainingMinutes = (booking.endsAt.getTime() - from.getTime()) / MS_PER_MINUTE;
    if (remainingMinutes < MIN_USABLE_REMAINING_MINUTES) {
      return null;
    }

    const queue = this.waitlists.get(booking.roomId) ?? [];
    const candidate = queue.find(
      (entry) => !alreadyOffered.has(entry.userId) && entry.userId !== booking.holderUserId,
    );
    if (!candidate) {
      return null;
    }

    this.offerSequence += 1;
    const expiresAt = new Date(
      Math.min(from.getTime() + OFFER_TTL_MINUTES * MS_PER_MINUTE, booking.endsAt.getTime()),
    );

    const offer: ReclaimOffer = {
      offerId: `OFFER-${String(this.offerSequence).padStart(4, "0")}`,
      bookingId: booking.bookingId,
      roomId: booking.roomId,
      offeredToUserId: candidate.userId,
      offeredAt: from,
      expiresAt,
      slotStartsAt: from,
      slotEndsAt: booking.endsAt,
      status: "OFFERED",
    };

    this.offers.set(offer.offerId, offer);
    return { ...offer };
  }

  private usersAlreadyOffered(bookingId: string): Set<string> {
    return new Set(
      Array.from(this.offers.values())
        .filter((offer) => offer.bookingId === bookingId)
        .map((offer) => offer.offeredToUserId),
    );
  }

  private removeFromWaitlist(roomId: string, userId: string): void {
    const queue = this.waitlists.get(roomId);
    if (!queue) {
      return;
    }
    this.waitlists.set(
      roomId,
      queue.filter((entry) => entry.userId !== userId),
    );
  }

  private requireBooking(bookingId: string): RoomBooking {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Unknown booking '${bookingId}'.`);
    }
    return booking;
  }

  private requireOffer(offerId: string): ReclaimOffer {
    const offer = this.offers.get(offerId);
    if (!offer) {
      throw new Error(`Unknown reclaim offer '${offerId}'.`);
    }
    return offer;
  }
}

export const roomNoShowReclaimService = new RoomNoShowReclaimService();
