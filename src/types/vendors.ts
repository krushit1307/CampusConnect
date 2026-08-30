/**
 * Vendor and SLA Types for CampusConnect
 * Defines interfaces for milestone tracking, penalty calculation, and check-in workflows.
 */

export interface VendorMilestone {
    id: string;
    vendor_id: string;
    club_id: string;
    description: string;
    total_amount: number;
    deadline_timestamp: string;
    actual_arrival_timestamp: string | null;
    sla_penalty_percentage: number;
    sla_penalty_amount: number;
    final_payout_amount: number;
    status: 'pending' | 'completed' | 'disputed';
}

export interface VendorCheckInPayload {
    milestoneId: string;
    vendorId: string;
    qrCodeData: string; // Contains venue verification token
}

export interface SLACalculationResult {
    delayMinutes: number;
    penaltyPercentage: number;
    penaltyAmount: number;
    finalPayout: number;
    message: string;
}
