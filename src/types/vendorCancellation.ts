// ─── Automated Event Cancellation Vendor Notification Types ────────────────

export type VendorServiceCategory =
  | "catering"
  | "av_equipment"
  | "security"
  | "venue_facility"
  | "photography"
  | "staging_decor"
  | "transportation";

export type VendorNotificationChannel = "email" | "sms" | "webhook" | "vendor_portal";

export type VendorContractStatus =
  | "booked"
  | "cancellation_pending"
  | "cancelled"
  | "penalty_assessed"
  | "refunded";

export interface VendorCancellationPolicy {
  noticeDays7FeePercent: number; // Penalty % if > 7 days notice (e.g. 0%)
  noticeDays2FeePercent: number; // Penalty % if 2 - 7 days notice (e.g. 25%)
  noticeUnder48hFeePercent: number; // Penalty % if < 48 hours notice (e.g. 50%)
  noticeUnder24hFeePercent: number; // Penalty % if < 24 hours emergency notice (e.g. 100%)
}

export interface EventVendorBooking {
  id: string; // e.g. "VND-BKG-8801"
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  vendorId: string;
  vendorName: string;
  category: VendorServiceCategory;
  contactEmail: string;
  contactPhone: string;
  webhookUrl?: string;
  contractAmountCents: number;
  depositPaidCents: number;
  cancellationPolicy: VendorCancellationPolicy;
  status: VendorContractStatus;
  notes?: string;
}

export interface VendorCancellationFeeCalculation {
  noticeDays: number;
  noticeHours: number;
  applicableFeePercent: number;
  cancellationFeeCents: number;
  depositRefundCents: number;
  balanceDueCents: number; // Owed by organizer if fee exceeds deposit
  policyDescription: string;
}

export interface VendorCancellationNotification {
  id: string; // e.g. "VND-NTF-104"
  bookingId: string;
  vendorId: string;
  vendorName: string;
  eventId: string;
  eventTitle: string;
  reason: string;
  channelsSent: VendorNotificationChannel[];
  feeCalculation: VendorCancellationFeeCalculation;
  notifiedAt: Date;
  status: "pending" | "sent" | "delivered" | "failed" | "acknowledged";
  acknowledgementRef?: string;
  acknowledgedAt?: Date;
  vendorNotes?: string;
}

export interface VendorCancellationSummary {
  eventId: string;
  eventTitle: string;
  cancellationDate: Date;
  totalVendorsNotified: number;
  totalContractedAmountCents: number;
  totalCancellationFeesCents: number;
  totalRefundsDueCents: number;
  notifications: VendorCancellationNotification[];
}
