/**
 * Type definitions for Interactive Vendor Bidding Escrow Slashing for Delays.
 * Issue: #5095 - Interactive Vendor Bidding Escrow Slashing for Delays
 */

export type EscrowContractStatus =
  | "FUNDED_IN_ESCROW"
  | "RELEASED_TO_VENDOR"
  | "PARTIALLY_SLASHED"
  | "FULLY_SLASHED"
  | "DISPUTED";

export type BreachSeverity = "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL";

export type BreachType =
  | "LATE_ARRIVAL"
  | "DELAYED_SETUP"
  | "MISSING_EQUIPMENT"
  | "EARLY_DEPARTURE"
  | "SERVICE_INTERRUPTION";

export interface VendorEscrowContract {
  id: string;
  auctionId: string;
  eventId: string;
  eventName: string;
  organizerId: string;
  organizerName: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  totalEscrowAmount: number; // e.g. $1500
  slashedAmount: number;
  netVendorPayout: number;
  organizerRefundAmount: number;
  scheduledArrivalTime: string; // ISO String
  contractedSetupDeadline: string; // ISO String
  status: EscrowContractStatus;
  breachCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlashingTier {
  minDelayMinutes: number;
  maxDelayMinutes: number;
  slashPercentage: number; // e.g. 10 for 10%
  severity: BreachSeverity;
  description: string;
}

export interface VendorEscrowSlashingCalculation {
  contractId: string;
  delayMinutes: number;
  breachType: BreachType;
  baseEscrowAmount: number;
  slashPercentage: number;
  slashAmount: number;
  netVendorPayout: number;
  organizerRefundAmount: number;
  severity: BreachSeverity;
  applicableTierDescription: string;
  isGracePeriod: boolean;
}

export interface DelayBreachRecord {
  id: string;
  contractId: string;
  eventId: string;
  vendorId: string;
  breachType: BreachType;
  delayMinutes: number;
  slashPercentage: number;
  slashedAmount: number;
  reasonNotes: string;
  loggedByUserId: string;
  loggedAt: string;
}

export interface SlashingExecutionResult {
  success: boolean;
  contract: VendorEscrowContract;
  breachRecord: DelayBreachRecord;
  message: string;
}
