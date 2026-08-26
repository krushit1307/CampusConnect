/**
 * Refund Types for CampusConnect
 * Defines interfaces for partial and mass refund operations.
 */

export type RefundType = 'percentage' | 'flat_amount';

export interface PartialRefundRequest {
    eventId: string;
    refundType: RefundType;
    value: number; // Percentage (0-100) or flat amount in cents
    reason: string;
}

export interface RefundResult {
    success: boolean;
    totalProcessed: number;
    totalFailed: number;
    totalRefundedAmount: number;
    failedPaymentIntentIds: string[];
}

export interface RefundStatus {
    id: string;
    event_id: string;
    payment_intent_id: string;
    original_amount: number;
    refunded_amount: number;
    status: 'pending' | 'succeeded' | 'failed';
    failure_reason: string | null;
    created_at: string;
}
