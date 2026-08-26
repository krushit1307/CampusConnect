import { describe, it, expect, beforeEach } from "vitest";
import { vendorCancellationNotificationService } from "../vendorCancellationNotificationService";
import { EventVendorBooking } from "@/types/vendorCancellation";

describe("vendorCancellationNotificationService", () => {
  beforeEach(() => {
    vendorCancellationNotificationService.resetState();
  });

  it("fetches contracted vendors for a given event", () => {
    const vendors = vendorCancellationNotificationService.getEventBookedVendors("evt-902");
    expect(vendors.length).toBe(3);
    expect(vendors.map((v) => v.category)).toContain("catering");
    expect(vendors.map((v) => v.category)).toContain("av_equipment");
    expect(vendors.map((v) => v.category)).toContain("security");
  });

  it("calculates 0% fee for cancellation > 7 days in advance", () => {
    const booking: EventVendorBooking = {
      id: "test-bkg-1",
      eventId: "evt-test",
      eventTitle: "Test Event",
      eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days away
      vendorId: "v1",
      vendorName: "Test Catering",
      category: "catering",
      contactEmail: "test@vendor.com",
      contactPhone: "555-0000",
      contractAmountCents: 100000, // $1,000
      depositPaidCents: 30000, // $300 deposit
      cancellationPolicy: {
        noticeDays7FeePercent: 0,
        noticeDays2FeePercent: 25,
        noticeUnder48hFeePercent: 50,
        noticeUnder24hFeePercent: 100,
      },
      status: "booked",
    };

    const calc = vendorCancellationNotificationService.calculateVendorCancellationFees(
      booking,
      booking.eventDate,
      new Date(),
    );

    expect(calc.applicableFeePercent).toBe(0);
    expect(calc.cancellationFeeCents).toBe(0);
    expect(calc.depositRefundCents).toBe(30000); // 100% deposit refunded
  });

  it("calculates 25% fee for cancellation between 2 and 7 days in advance", () => {
    const booking: EventVendorBooking = {
      id: "test-bkg-2",
      eventId: "evt-test",
      eventTitle: "Test Event",
      eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days away
      vendorId: "v1",
      vendorName: "Test Catering",
      category: "catering",
      contactEmail: "test@vendor.com",
      contactPhone: "555-0000",
      contractAmountCents: 200000, // $2,000
      depositPaidCents: 100000, // $1,000 deposit
      cancellationPolicy: {
        noticeDays7FeePercent: 0,
        noticeDays2FeePercent: 25,
        noticeUnder48hFeePercent: 50,
        noticeUnder24hFeePercent: 100,
      },
      status: "booked",
    };

    const calc = vendorCancellationNotificationService.calculateVendorCancellationFees(
      booking,
      booking.eventDate,
      new Date(),
    );

    expect(calc.applicableFeePercent).toBe(25);
    expect(calc.cancellationFeeCents).toBe(50000); // $500 fee (25% of $2,000)
    expect(calc.depositRefundCents).toBe(50000); // $500 deposit refunded ($1,000 - $500)
  });

  it("calculates 100% fee for emergency cancellation under 24 hours", () => {
    const booking: EventVendorBooking = {
      id: "test-bkg-3",
      eventId: "evt-test",
      eventTitle: "Test Event",
      eventDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours away
      vendorId: "v1",
      vendorName: "Test Catering",
      category: "catering",
      contactEmail: "test@vendor.com",
      contactPhone: "555-0000",
      contractAmountCents: 100000, // $1,000
      depositPaidCents: 50000, // $500 deposit
      cancellationPolicy: {
        noticeDays7FeePercent: 0,
        noticeDays2FeePercent: 25,
        noticeUnder48hFeePercent: 50,
        noticeUnder24hFeePercent: 100,
      },
      status: "booked",
    };

    const calc = vendorCancellationNotificationService.calculateVendorCancellationFees(
      booking,
      booking.eventDate,
      new Date(),
    );

    expect(calc.applicableFeePercent).toBe(100);
    expect(calc.cancellationFeeCents).toBe(100000); // $1,000 fee
    expect(calc.depositRefundCents).toBe(0); // 0 deposit refund
    expect(calc.balanceDueCents).toBe(50000); // $500 remaining balance due
  });

  it("dispatches multi-channel vendor notifications upon cancellation", () => {
    const summary = vendorCancellationNotificationService.notifyVendorsOfCancellation(
      "evt-902",
      "Annual Campus Spring Gala",
      "Blizzard Warning",
    );

    expect(summary.totalVendorsNotified).toBe(3);
    expect(summary.notifications.length).toBe(3);
    expect(summary.notifications[0].channelsSent).toContain("email");
    expect(summary.notifications[0].channelsSent).toContain("sms");
  });

  it("handles vendor notification acknowledgment", () => {
    const summary = vendorCancellationNotificationService.notifyVendorsOfCancellation(
      "evt-902",
      "Annual Campus Spring Gala",
    );

    const notificationId = summary.notifications[0].id;
    const ackResult = vendorCancellationNotificationService.acknowledgeVendorCancellation(
      notificationId,
      "Received and confirmed",
    );

    expect(ackResult).toBe(true);

    const history = vendorCancellationNotificationService.getVendorCancellationHistory("evt-902");
    const ackNtf = history.find((h) => h.id === notificationId);
    expect(ackNtf?.status).toBe("acknowledged");
    expect(ackNtf?.vendorNotes).toBe("Received and confirmed");
  });
});
