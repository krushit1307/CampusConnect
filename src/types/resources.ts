/**
 * Resource and Deposit Types for CampusConnect
 * Defines interfaces for hardware resources, bookings, and deposit holds.
 */

export type HoldStatus = 'active' | 'released' | 'deducted';

export interface Resource {
    id: string;
    name: string;
    description: string;
    category: string;
    replacement_value: number;
    deposit_required: number;
    available: boolean;
    created_at: string;
    updated_at: string;
}

export interface ResourceBooking {
    id: string;
    resource_id: string;
    club_id: string;
    start_time: string;
    end_time: string;
    status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
    created_at: string;
}

export interface DepositHold {
    id: string;
    resource_id: string;
    club_id: string;
    booking_id: string;
    hold_amount: number;
    status: HoldStatus;
    created_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
}

export interface BookingRequest {
    resourceId: string;
    clubId: string;
    startTime: string;
    endTime: string;
}

export interface CheckInRequest {
    bookingId: string;
    condition: 'undamaged' | 'damaged';
    notes?: string;
    adminId: string;
}
