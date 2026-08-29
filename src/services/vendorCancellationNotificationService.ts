import {
  EventVendorBooking,
  VendorCancellationFeeCalculation,
  VendorCancellationNotification,
  VendorCancellationSummary,
  VendorContractStatus,
} from "@/types/vendorCancellation";

// ─── Default Mock Vendor Bookings ─────────────────────────────────────────

const DEFAULT_BOOKINGS: EventVendorBooking[] = [
  {
    id: "VND-BKG-101",
    eventId: "evt-902",
    eventTitle: "Annual Campus Spring Gala & Music Fest",
    eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days away
    vendorId: "vnd-cat-01",
    vendorName: "Gourmet Campus Catering Co.",
    category: "catering",
    contactEmail: "orders@gourmetcampuscatering.com",
    contactPhone: "(555) 234-5678",
    webhookUrl: "https://api.gourmetcampuscatering.com/webhooks/campus-connect",
    contractAmountCents: 350000, // $3,500.00
    depositPaidCents: 100000, // $1,000.00 deposit
    cancellationPolicy: {
      noticeDays7FeePercent: 0,
      noticeDays2FeePercent: 25,
      noticeUnder48hFeePercent: 50,
      noticeUnder24hFeePercent: 100,
    },
    status: "booked",
    notes: "Requires full buffet setup & dietary vegan options.",
  },
  {
    id: "VND-BKG-102",
    eventId: "evt-902",
    eventTitle: "Annual Campus Spring Gala & Music Fest",
    eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days away
    vendorId: "vnd-av-02",
    vendorName: "ProAudio Sound & Lighting Solutions",
    category: "av_equipment",
    contactEmail: "dispatch@proaudiosolutions.com",
    contactPhone: "(555) 987-6543",
    webhookUrl: "https://api.proaudiosolutions.com/campus/cancel-hook",
    contractAmountCents: 180000, // $1,800.00
    depositPaidCents: 50000, // $500.00 deposit
    cancellationPolicy: {
      noticeDays7FeePercent: 0,
      noticeDays2FeePercent: 20,
      noticeUnder48hFeePercent: 50,
      noticeUnder24hFeePercent: 100,
    },
    status: "booked",
    notes: "Outdoor stage truss & 8kW PA system.",
  },
  {
    id: "VND-BKG-103",
    eventId: "evt-902",
    eventTitle: "Annual Campus Spring Gala & Music Fest",
    eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days away
    vendorId: "vnd-sec-03",
    vendorName: "Campus Safety Escort & Event Guards",
    category: "security",
    contactEmail: "scheduling@campussafetyguards.org",
    contactPhone: "(555) 345-6789",
    contractAmountCents: 75000, // $750.00
    depositPaidCents: 25000, // $250.00 deposit
    cancellationPolicy: {
      noticeDays7FeePercent: 0,
      noticeDays2FeePercent: 10,
      noticeUnder48hFeePercent: 30,
      noticeUnder24hFeePercent: 100,
    },
    status: "booked",
    notes: "6 licensed security guards for main entrance & perimeter.",
  },
  {
    id: "VND-BKG-104",
    eventId: "evt-903",
    eventTitle: "Fall Robotics Hackathon",
    eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days away
    vendorId: "vnd-cat-01",
    vendorName: "Gourmet Campus Catering Co.",
    category: "catering",
    contactEmail: "orders@gourmetcampuscatering.com",
    contactPhone: "(555) 234-5678",
    contractAmountCents: 120000, // $1,200.00
    depositPaidCents: 30000,
    cancellationPolicy: {
      noticeDays7FeePercent: 0,
      noticeDays2FeePercent: 25,
      noticeUnder48hFeePercent: 50,
      noticeUnder24hFeePercent: 100,
    },
    status: "booked",
  },
];

class VendorCancellationNotificationService {
  private bookings: EventVendorBooking[] = [...DEFAULT_BOOKINGS];
  private notifications: VendorCancellationNotification[] = [];

  /**
   * Retrieves all contracted vendor bookings for a specific event.
   */
  public getEventBookedVendors(eventId: string): EventVendorBooking[] {
    return this.bookings.filter((b) => b.eventId === eventId);
  }

  /**
   * Calculates vendor cancellation penalty fee and deposit refund based on notice window.
   */
  public calculateVendorCancellationFees(
    booking: EventVendorBooking,
    eventDate: Date = booking.eventDate,
    cancellationDate: Date = new Date(),
  ): VendorCancellationFeeCalculation {
    const diffMs = Math.max(0, eventDate.getTime() - cancellationDate.getTime());
    const noticeHours = Math.round(diffMs / (1000 * 60 * 60));
    const noticeDays = Math.round(noticeHours / 24);

    let applicableFeePercent = 0;
    let policyDescription = "";

    const policy = booking.cancellationPolicy;

    if (noticeHours < 24) {
      applicableFeePercent = policy.noticeUnder24hFeePercent;
      policyDescription = "Emergency < 24 Hours Notice (Full deposit retention)";
    } else if (noticeHours < 48) {
      applicableFeePercent = policy.noticeUnder48hFeePercent;
      policyDescription = "Late < 48 Hours Notice (50% fee)";
    } else if (noticeDays <= 7) {
      applicableFeePercent = policy.noticeDays2FeePercent;
      policyDescription = "Notice 2 to 7 Days in Advance (Standard fee)";
    } else {
      applicableFeePercent = policy.noticeDays7FeePercent;
      policyDescription = "Early Notice > 7 Days in Advance (0% penalty - Full Refund)";
    }

    // Cancellation fee calculated against contract total
    const cancellationFeeCents = Math.round(
      (booking.contractAmountCents * applicableFeePercent) / 100,
    );

    // Deposit refund calculation
    let depositRefundCents = 0;
    let balanceDueCents = 0;

    if (booking.depositPaidCents >= cancellationFeeCents) {
      depositRefundCents = booking.depositPaidCents - cancellationFeeCents;
    } else {
      balanceDueCents = cancellationFeeCents - booking.depositPaidCents;
    }

    return {
      noticeDays,
      noticeHours,
      applicableFeePercent,
      cancellationFeeCents,
      depositRefundCents,
      balanceDueCents,
      policyDescription,
    };
  }

  /**
   * Dispatches automated multi-channel cancellation notifications to all contracted vendors for an event.
   */
  public notifyVendorsOfCancellation(
    eventId: string,
    eventTitle: string,
    reason: string = "Event cancelled by campus organizer",
    cancellationDate: Date = new Date(),
  ): VendorCancellationSummary {
    const eventBookings = this.getEventBookedVendors(eventId);
    const notifications: VendorCancellationNotification[] = [];

    let totalContractedAmountCents = 0;
    let totalCancellationFeesCents = 0;
    let totalRefundsDueCents = 0;

    eventBookings.forEach((booking) => {
      const feeCalc = this.calculateVendorCancellationFees(
        booking,
        booking.eventDate,
        cancellationDate,
      );

      // Update booking status
      booking.status = "cancelled";

      totalContractedAmountCents += booking.contractAmountCents;
      totalCancellationFeesCents += feeCalc.cancellationFeeCents;
      totalRefundsDueCents += feeCalc.depositRefundCents;

      // Simulated multi-channel dispatch (Email, SMS, Webhook)
      const channelsSent: ("email" | "sms" | "webhook")[] = ["email", "sms"];
      if (booking.webhookUrl) {
        channelsSent.push("webhook");
      }

      const notification: VendorCancellationNotification = {
        id: `VND-NTF-${Math.floor(1000 + Math.random() * 9000)}`,
        bookingId: booking.id,
        vendorId: booking.vendorId,
        vendorName: booking.vendorName,
        eventId,
        eventTitle,
        reason,
        channelsSent,
        feeCalculation: feeCalc,
        notifiedAt: cancellationDate,
        status: "delivered",
      };

      notifications.push(notification);
      this.notifications.push(notification);
    });

    return {
      eventId,
      eventTitle,
      cancellationDate,
      totalVendorsNotified: notifications.length,
      totalContractedAmountCents,
      totalCancellationFeesCents,
      totalRefundsDueCents,
      notifications,
    };
  }

  /**
   * Allows vendor to acknowledge cancellation receipt.
   */
  public acknowledgeVendorCancellation(
    notificationId: string,
    vendorNotes?: string,
  ): boolean {
    const ntf = this.notifications.find((n) => n.id === notificationId);
    if (!ntf) return false;

    ntf.status = "acknowledged";
    ntf.acknowledgedAt = new Date();
    ntf.acknowledgementRef = `ACK-${Date.now()}`;
    if (vendorNotes) {
      ntf.vendorNotes = vendorNotes;
    }
    return true;
  }

  /**
   * Retrieves notification history for an event.
   */
  public getVendorCancellationHistory(eventId: string): VendorCancellationNotification[] {
    return this.notifications.filter((n) => n.eventId === eventId);
  }

  /**
   * Reset mock data state (for testing).
   */
  public resetState() {
    this.bookings = [...DEFAULT_BOOKINGS];
    this.notifications = [];
  }
}

export const vendorCancellationNotificationService = new VendorCancellationNotificationService();
